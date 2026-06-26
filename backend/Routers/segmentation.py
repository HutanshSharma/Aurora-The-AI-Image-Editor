from fastapi import APIRouter, HTTPException, File, UploadFile, Depends
from pydantic import BaseModel
from collections import OrderedDict
import threading
import uuid
import io
import torch
import numpy as np
from PIL import Image
from mobile_sam import sam_model_registry, SamPredictor
from .auth import get_current_user
from ..segmentation_inpainting.utils import (
    extract_object_with_transparency,
    encode_image_to_base64,
)

router = APIRouter(
    tags=["/editing"],
    prefix="/editing",
    dependencies=[Depends(get_current_user)]
)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

MAX_STORED_IMAGES = 20
IMAGE_STORE = OrderedDict()

def store_image(image_id, data):
    IMAGE_STORE[image_id] = data
    IMAGE_STORE.move_to_end(image_id)
    evicted = False
    while len(IMAGE_STORE) > MAX_STORED_IMAGES:
        IMAGE_STORE.popitem(last=False)
        evicted = True
    if evicted and DEVICE == "cuda":
        torch.cuda.empty_cache()

def get_stored_image(image_id):
    """Fetch a stored image and mark it most-recently-used, or 404."""
    if image_id not in IMAGE_STORE:
        raise HTTPException(404, "Image ID not found")
    IMAGE_STORE.move_to_end(image_id)
    return IMAGE_STORE[image_id]

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
predictor_lock = threading.Lock()

class ExtractSegmentRequest(BaseModel):
    image_id: str
    segment_index: int

class GetSegmentAtPointRequest(BaseModel):
    image_id: str
    x: int
    y: int

@router.post("/upload_and_segment")
def upload_and_segment(file: UploadFile = File(...)):
    """
    Upload image and automatically generate segmentation masks using grid sampling.
    Returns the original image and stores all segments for later retrieval.

    Sync def on purpose: the grid sweep is multi-second CPU/GPU work, so FastAPI
    runs it in the threadpool and the event loop stays free for other requests.
    """
    try:
        print(f"[SEGMENTATION] Received upload request")
        print(f"[SEGMENTATION] Filename: {file.filename}, Content-Type: {file.content_type}")
        contents = file.file.read()
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
        
        h, w = image_np.shape[:2]
        image_area = h * w
        if image_area > 2000 * 2000:
            grid_points = 40  
        elif image_area > 1500 * 1500:
            grid_points = 36
        elif image_area > 1000 * 1000:
            grid_points = 32
        elif image_area > 500 * 500:
            grid_points = 28
        else:
            grid_points = 24 

        segment_map = {}

        y_coords = np.linspace(0, h - 1, grid_points, dtype=int)
        x_coords = np.linspace(0, w - 1, grid_points, dtype=int)
        all_points = [[int(x), int(y)] for y in y_coords for x in x_coords]
        total_points = len(all_points)

        print(f"[SEGMENTATION] Grid sampling {grid_points}x{grid_points} = {total_points} points for {w}x{h} image")
        input_label = np.array([1])
        with predictor_lock:
            predictor.set_image(image_np)
            print(f"[SEGMENTATION] Image set in predictor")
            with torch.inference_mode():
                for i, point in enumerate(all_points):
                    masks, _, _ = predictor.predict(
                        point_coords=np.array([point]),
                        point_labels=input_label,
                        multimask_output=False
                    )
                    mask = masks[0]
                    mask_hash = hash(mask.tobytes())
                    if mask_hash not in segment_map:
                        area = int(np.sum(mask))
                        if area > 100:
                            segment_map[mask_hash] = {
                                'segmentation': mask,
                                'area': area,
                                'bbox': get_bbox_from_mask(mask),
                            }
                    if (i + 1) % 100 == 0 or i + 1 == total_points:
                        print(f"[SEGMENTATION] Processed {i + 1}/{total_points} points")

        segments = list(segment_map.values())
        segments = sorted(segments, key=lambda x: x['area'], reverse=True)
        
        print(f"[SEGMENTATION] Found {len(segments)} unique segments")
        
        store_image(image_id, {
            "image": image_np,
            "shape": image_np.shape[:2],
            "segments": segments
        })

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

@router.post("/extract_segment")
def extract_segment(req: ExtractSegmentRequest):
    """Extract a pre-computed segment by its index as a transparent RGBA PNG."""
    try:
        img_data = get_stored_image(req.image_id)
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

@router.post("/get_segment_at_point")
def get_segment_at_point(req: GetSegmentAtPointRequest):
    """
    Get the segment at a specific point in the image.
    Used when the user long-presses on the image to select an object.
    """
    try:
        img_data = get_stored_image(req.image_id)
        x, y = req.x, req.y
        h, w = img_data["shape"]
        x = max(0, min(x, w - 1))
        y = max(0, min(y, h - 1))

        segments = img_data["segments"]
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

            print(f"[SEGMENT SELECT] {len(matching_segments)} matches, picked smallest (area={best_segment['area']})")

            return {
                "success": True,
                "has_segment": True,
                "segment_index": best_index,
            }
        return {
            "success": True,
            "has_segment": False,
            "message": "No segment at this point"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/clear_memory")
def clear_memory():
    IMAGE_STORE.clear()
    if DEVICE == "cuda":
        torch.cuda.empty_cache()
    return {"message": "Memory Cleared!"}