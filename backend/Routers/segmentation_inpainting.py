from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import uuid
import torch
from ..segmentation_inpainting.utils import (
    decode_base64_image, 
    encode_mask_to_base64,
    extract_object_with_transparency,
    encode_image_to_base64,
    place_object_on_background
)
import numpy as np
from mobile_sam import sam_model_registry, SamPredictor

router = APIRouter(
    tags=["/editing"],
    prefix="/editing"
)
IMAGE_STORE = {}
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

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
    mask_base64: str  # The mask returned from apply_mask

class PlaceObjectRequest(BaseModel):
    object_base64: str  # Transparent object from extract_object
    background_image: str = None  # Optional background image (base64)
    background_color: list = [255, 255, 255]  # Default white [R, G, B]

@router.post("/upload_image")
def upload_image(req: UploadImageRequest):
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
        # Check if image exists
        if req.image_id not in IMAGE_STORE:
            raise HTTPException(404, "Image ID not found")
        
        # Get original image
        img_data = IMAGE_STORE[req.image_id]
        img_rgb = img_data["image"]
        
        # Decode mask from base64
        mask_base64_clean = req.mask_base64
        if "," in mask_base64_clean:
            mask_base64_clean = mask_base64_clean.split(",")[1]
        
        from PIL import Image
        import io
        mask_bytes = base64.b64decode(mask_base64_clean)
        mask_image = Image.open(io.BytesIO(mask_bytes)).convert("L")
        mask_array = np.array(mask_image) > 127  # Convert to boolean
        
        # Extract object with transparency
        object_rgba = extract_object_with_transparency(img_rgb, mask_array)
        
        # Encode to base64
        object_base64 = encode_image_to_base64(object_rgba)
        
        return {
            "success": True,
            "object_base64": object_base64,
            "size": object_rgba.size,
            "message": "Object extracted with transparent background"
        }
    
    except Exception as e:
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
        # Decode transparent object
        object_base64_clean = req.object_base64
        if "," in object_base64_clean:
            object_base64_clean = object_base64_clean.split(",")[1]
        
        from PIL import Image
        import io
        import base64
        
        object_bytes = base64.b64decode(object_base64_clean)
        object_rgba = Image.open(io.BytesIO(object_bytes)).convert("RGBA")
        
        # Handle background
        background_rgb = None
        if req.background_image:
            # Decode background image
            bg_base64_clean = req.background_image
            if "," in bg_base64_clean:
                bg_base64_clean = bg_base64_clean.split(",")[1]
            
            bg_bytes = base64.b64decode(bg_base64_clean)
            background_rgb = Image.open(io.BytesIO(bg_bytes)).convert("RGB")
        
        # Place object on background
        background_color = tuple(req.background_color)
        composite = place_object_on_background(object_rgba, background_rgb, background_color)
        
        # Encode result
        composite_base64 = encode_image_to_base64(composite)
        
        return {
            "success": True,
            "composite_base64": composite_base64,
            "size": composite.size,
            "message": "Object placed on background"
        }
    
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/clear_memory")
def clear_memory():
    IMAGE_STORE.clear()
    if DEVICE == "cuda":
        torch.cuda.empty_cache()
    return {"message": "Memory Cleared!"}