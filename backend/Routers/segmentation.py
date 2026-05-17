from fastapi import APIRouter, HTTPException, File, UploadFile
from pydantic import BaseModel
import uuid
import torch
import base64
import io
from PIL import Image
from ..segmentation_inpainting.utils import (
    decode_base64_image, 
    encode_mask_to_base64,
    extract_object_with_transparency,
    encode_image_to_base64,
    place_object_on_background
)
import numpy as np
from mobile_sam import sam_model_registry, SamPredictor
import base64
from PIL import Image
import io

router = APIRouter(
    tags=["/editing"],
    prefix="/editing"
)
IMAGE_STORE = {}
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

@router.get("/health")
def health_check():
    """Health check endpoint to verify the API is running"""
    return {
        "status": "healthy",
        "device": DEVICE,
        "model_loaded": mobile_sam_model is not None,
        "cuda_available": torch.cuda.is_available(),
        "cuda_device_count": torch.cuda.device_count() if torch.cuda.is_available() else 0,
        "pytorch_version": torch.__version__,
        "cuda_version": torch.version.cuda if torch.cuda.is_available() else None
    }

checkpoint_path = "backend/segmentation_inpainting/mobile_sam.pt"
model_type = "vit_t"
mobile_sam_model = sam_model_registry[model_type](checkpoint=checkpoint_path)
mobile_sam_model.to(device=DEVICE)
mobile_sam_model.eval()

predictor = SamPredictor(mobile_sam_model)
print("Model loaded on:", DEVICE)

class UploadImageRequest(BaseModel):
    image: str

class MaskRequest(BaseModel):
    image_id: str
    coordinates_list: list

class ExtractObjectRequest(BaseModel):
    image_id: str
    mask_base64: str

class ExtractSegmentRequest(BaseModel):
    image_id: str
    segment_index: int

class PlaceObjectRequest(BaseModel):
    object_base64: str 
    background_image: str = None 
    background_color: list = [255, 255, 255]

class GetSegmentAtPointRequest(BaseModel):
    image_id: str
    x: int
    y: int

@router.post("/upload_and_segment")
async def upload_and_segment(file: UploadFile = File(...)):
    """
    Upload image and automatically generate segmentation masks using grid sampling.
    Returns the original image and stores all segments for later retrieval.
    """
    try:
        print(f"[SEGMENTATION] Received upload request")
        print(f"[SEGMENTATION] Filename: {file.filename}, Content-Type: {file.content_type}")
        contents = await file.read()
        print(f"[SEGMENTATION] File size: {len(contents)} bytes")
        image = Image.open(io.BytesIO(contents))
        if image.mode == 'RGBA':
            background = Image.new('RGB', image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[3])
            image = background
            print(f"[SEGMENTATION] Converted RGBA to RGB")
        elif image.mode != 'RGB':
            image = image.convert('RGB')
            print(f"[SEGMENTATION] Converted {image.mode} to RGB")
        
        original_size = image.size
        print(f"[SEGMENTATION] Original size: {original_size}")
        
        # Use higher limit to preserve quality and coordinate accuracy
        max_dim = 2048
        if max(image.size) > max_dim:
            ratio = max_dim / max(image.size)
            new_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
            image = image.resize(new_size, Image.Resampling.LANCZOS)
            print(f"[SEGMENTATION] Resized to: {image.size}")
        
        image_np = np.array(image)
        print(f"[SEGMENTATION] Image array: shape={image_np.shape}, dtype={image_np.dtype}")
        
        image_id = str(uuid.uuid4())
        print(f"[SEGMENTATION] Generated image_id: {image_id}")
        
        predictor.set_image(image_np)
        print(f"[SEGMENTATION] Image set in predictor")
        
        h, w = image_np.shape[:2]
        # Dynamic grid points based on image size
        # Larger images need MORE points for better segmentation accuracy
        image_area = h * w
        if image_area > 2000 * 2000:
            grid_points = 40  # More points for very large images
        elif image_area > 1500 * 1500:
            grid_points = 36
        elif image_area > 1000 * 1000:
            grid_points = 32
        elif image_area > 500 * 500:
            grid_points = 28
        else:
            grid_points = 24  # Fewer points for smaller images
        
        segments = []
        segment_map = {} 
        
        y_coords = np.linspace(0, h - 1, grid_points, dtype=int)
        x_coords = np.linspace(0, w - 1, grid_points, dtype=int)
        
        print(f"[SEGMENTATION] Starting grid sampling with {grid_points}x{grid_points} points for {w}x{h} image")
        
        # Batch processing for GPU optimization
        batch_size = 16  # Process multiple points at once
        all_points = []
        for y in y_coords:
            for x in x_coords:
                all_points.append([x, y])
        
        total_points = len(all_points)
        print(f"[SEGMENTATION] Total points to process: {total_points}")
        
        # Process in batches for better GPU utilization
        for batch_start in range(0, total_points, batch_size):
            batch_end = min(batch_start + batch_size, total_points)
            batch_points = all_points[batch_start:batch_end]
            
            # Process each point (SAM doesn't support true batching of different points)
            for point in batch_points:
                input_point = np.array([point])
                input_label = np.array([1])
                
                with torch.no_grad():  # Disable gradient computation for inference
                    masks, scores, _ = predictor.predict(
                        point_coords=input_point,
                        point_labels=input_label,
                        multimask_output=False
                    )
                
                mask = masks[0]
                score = scores[0]                
                mask_hash = hash(mask.tobytes())
                
                if mask_hash not in segment_map:
                    area = np.sum(mask)
                    if area > 100:
                        segment_map[mask_hash] = {
                            'segmentation': mask,
                            'area': int(area),
                            'bbox': get_bbox_from_mask(mask),
                            'predicted_iou': float(score)
                        }
            
            if (batch_end) % 100 == 0 or batch_end == total_points:
                print(f"[SEGMENTATION] Processed {batch_end}/{total_points} points")
        
        segments = list(segment_map.values())
        segments = sorted(segments, key=lambda x: x['area'], reverse=True)
        
        print(f"[SEGMENTATION] Found {len(segments)} unique segments")
        
        IMAGE_STORE[image_id] = {
            "image": image_np,
            "shape": image_np.shape[:2],
            "original_size": original_size, 
            "processed_size": image.size,     
            "segments": segments
        }
        
        print(f"[SEGMENTATION] Successfully stored image and segments")
        
        return {
            "success": True,
            "message": "Image uploaded and segmented",
            "image_id": image_id,
            "size": list(image_np.shape),
            "num_segments": len(segments)
        }

    except Exception as e:
        print(f"[SEGMENTATION ERROR] {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, str(e))

def get_bbox_from_mask(mask):
    """Get bounding box [x, y, width, height] from binary mask"""
    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    if not np.any(rows) or not np.any(cols):
        return [0, 0, 0, 0]
    
    y_min, y_max = np.where(rows)[0][[0, -1]]
    x_min, x_max = np.where(cols)[0][[0, -1]]
    return [int(x_min), int(y_min), int(x_max - x_min), int(y_max - y_min)]

@router.post("/upload_image")
def upload_image(req: UploadImageRequest):
    """Legacy endpoint - just uploads without segmentation"""
    try:
        image_np = decode_base64_image(req.image)
        image_id = str(uuid.uuid4())

        IMAGE_STORE[image_id] = {
            "image": image_np,
            "shape": image_np.shape[:2]
        }
        return {
            "message": "Image uploaded",
            "image_id": image_id,
            "size": image_np.shape
        }

    except Exception as e:
        raise HTTPException(500, str(e))
    
@router.post("/apply_mask")
def apply_mask(req: MaskRequest):
    try:
        if req.image_id not in IMAGE_STORE:
            raise HTTPException(404, "Image ID not found")

        if len(req.coordinates_list) == 0:
            raise HTTPException(400, "No coordinates provided")

        img_data = IMAGE_STORE[req.image_id]
        img = img_data["image"]

        predictor.set_image(img)

        input_points = np.array(req.coordinates_list)
        input_labels = np.array([1] * len(req.coordinates_list))

        masks, scores, logits = predictor.predict(
            point_coords=input_points,
            point_labels=input_labels,
            multimask_output=True
        )

        best_idx = np.argmax(scores)
        best_mask = masks[best_idx]

        mask_b64 = encode_mask_to_base64(best_mask)

        return {
            "mask_base64": mask_b64,
            "score": float(scores[best_idx])
        }

    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/extract_object")
def extract_object(req: ExtractObjectRequest):
    """
    Extract the masked object with transparent background.
    This allows users to place the object on different backgrounds or use it for generative fill.
    
    Returns RGBA PNG with transparency where mask was False.
    """
    try:
        if req.image_id not in IMAGE_STORE:
            raise HTTPException(404, "Image ID not found")        
        img_data = IMAGE_STORE[req.image_id]
        img_rgb = img_data["image"]        
        mask_base64_clean = req.mask_base64
        if "," in mask_base64_clean:
            mask_base64_clean = mask_base64_clean.split(",")[1]
        
        mask_bytes = base64.b64decode(mask_base64_clean)
        mask_image = Image.open(io.BytesIO(mask_bytes)).convert("L")
        mask_array = np.array(mask_image) > 127 
        object_rgba = extract_object_with_transparency(img_rgb, mask_array)
        object_base64 = encode_image_to_base64(object_rgba)
        
        return {
            "success": True,
            "object_base64": object_base64,
            "size": object_rgba.size,
            "message": "Object extracted with transparent background"
        }
    
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/extract_segment")
def extract_segment(req: ExtractSegmentRequest):
    """
    Extract a pre-computed segment by its index.
    Much faster than extract_object since it doesn't need to send mask back and forth.
    """
    try:
        if req.image_id not in IMAGE_STORE:
            raise HTTPException(404, "Image ID not found")        
        img_data = IMAGE_STORE[req.image_id]
        
        if "segments" not in img_data:
            raise HTTPException(404, "No segments found for this image")
        
        segments = img_data["segments"]
        if req.segment_index < 0 or req.segment_index >= len(segments):
            raise HTTPException(400, f"Invalid segment index {req.segment_index}, max is {len(segments)-1}")        
        segment = segments[req.segment_index]
        mask = segment['segmentation']        
        img_rgb = img_data["image"]        
        object_rgba = extract_object_with_transparency(img_rgb, mask)        
        object_base64 = encode_image_to_base64(object_rgba)
        
        return {
            "success": True,
            "object_base64": object_base64,
            "size": list(object_rgba.size),
            "bbox": segment['bbox'],
            "message": "Segment extracted successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, str(e))

@router.post("/place_object")
def place_object(req: PlaceObjectRequest):
    """
    Place a transparent object on a background.
    
    Use cases:
    - Place extracted object on white canvas
    - Place extracted object on another image
    - Prepare composite for generative fill (SDXL)
    """
    try:
        object_base64_clean = req.object_base64
        if "," in object_base64_clean:
            object_base64_clean = object_base64_clean.split(",")[1]
                        
        object_bytes = base64.b64decode(object_base64_clean)
        object_rgba = Image.open(io.BytesIO(object_bytes)).convert("RGBA")        
        background_rgb = None
        if req.background_image:
            bg_base64_clean = req.background_image
            if "," in bg_base64_clean:
                bg_base64_clean = bg_base64_clean.split(",")[1]
            
            bg_bytes = base64.b64decode(bg_base64_clean)
            background_rgb = Image.open(io.BytesIO(bg_bytes)).convert("RGB")
        
        background_color = tuple(req.background_color)
        composite = place_object_on_background(object_rgba, background_rgb, background_color)
        
        composite_base64 = encode_image_to_base64(composite)
        
        return {
            "success": True,
            "composite_base64": composite_base64,
            "size": composite.size,
            "message": "Object placed on background"
        }
    
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/get_segment_at_point")
def get_segment_at_point(req: GetSegmentAtPointRequest):
    """
    Get the segment mask at a specific point in the image.
    Used when user long-presses on the image to select an object.
    """
    try:
        if req.image_id not in IMAGE_STORE:
            raise HTTPException(404, "Image ID not found")
        
        img_data = IMAGE_STORE[req.image_id]
        
        # Frontend sends coordinates in the processed image space
        # No transformation needed - coordinates are already correct
        x, y = req.x, req.y
        h, w = img_data["shape"]
        
        print(f"[SEGMENT SELECT] Received coords: ({req.x}, {req.y}), Image size: {w}x{h}")
        
        # Validate coordinates are within bounds
        if x < 0 or x >= w or y < 0 or y >= h:
            print(f"[SEGMENT SELECT] Coordinates out of bounds, clamping")
            x = max(0, min(x, w - 1))
            y = max(0, min(y, h - 1))
        
        if "segments" not in img_data:
            img = img_data["image"]
            predictor.set_image(img)
            
            input_points = np.array([[x, y]])
            input_labels = np.array([1])
            
            masks, scores, logits = predictor.predict(
                point_coords=input_points,
                point_labels=input_labels,
                multimask_output=True
            )
            
            best_idx = np.argmax(scores)
            best_mask = masks[best_idx]
            mask_b64 = encode_mask_to_base64(best_mask)
            
            return {
                "success": True,
                "mask_base64": mask_b64,
                "score": float(scores[best_idx]),
                "has_segment": True
            }
        
        segments = img_data["segments"]
        h, w = img_data["shape"]
        
        if y < 0 or y >= h or x < 0 or x >= w:
            raise HTTPException(400, f"Coordinates ({x}, {y}) out of bounds for image {w}x{h}")
        
        
        matching_segments = []
        for i, segment in enumerate(segments):
            bbox = segment['bbox']  # [x, y, width, height]
            bbox_x, bbox_y, bbox_w, bbox_h = bbox
            
            
            if (x >= bbox_x and x < bbox_x + bbox_w and 
                y >= bbox_y and y < bbox_y + bbox_h):
                
                mask = segment['segmentation']
                if mask[y, x]:
                    matching_segments.append((i, segment))
        
        if matching_segments:
            matching_segments.sort(key=lambda x: x[1]['area'])
            best_index, best_segment = matching_segments[0]
            
            print(f"[SEGMENT SELECT] Found {len(matching_segments)} matching segments, selected smallest (area={best_segment['area']})")
            
            mask_b64 = encode_mask_to_base64(best_segment['segmentation'])
            return {
                "success": True,
                "mask_base64": mask_b64,
                "score": float(best_segment.get('stability_score', 1.0)),
                "segment_index": best_index,
                "area": int(best_segment['area']),
                "has_segment": True
            }        
        return {
            "success": True,
            "has_segment": False,
            "message": "No segment at this point"
        }
    
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/clear_memory")
def clear_memory():
    IMAGE_STORE.clear()
    if DEVICE == "cuda":
        torch.cuda.empty_cache()
    return {"message": "Memory Cleared!"}