from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import uuid
import torch
from ..segmentation_inpainting.utils import decode_base64_image, encode_mask_to_base64
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

@router.post("/clear_memory")
def clear_memory():
    IMAGE_STORE.clear()
    if DEVICE == "cuda":
        torch.cuda.empty_cache()
    return {"message": "Memory Cleared!"}