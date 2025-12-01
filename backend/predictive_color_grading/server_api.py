# server_api.py
import base64
import io
from typing import List, Dict, Any

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel
from PIL import Image

from src.edits import Edit
from src.history import EditHistory
from src.predictive_branch import run_predictive_branch
from src.apply_edits import save_image


class EditIn(BaseModel):
    type: str
    params: Dict[str, Any]
    ai_improvable: bool = True


class PredictiveRequest(BaseModel):
    image_base64: str
    edits: List[EditIn]
    slide_index: int


class PredictiveResponse(BaseModel):
    ai_image_base64: str
    ai_params: Dict[str, float]


app = FastAPI(title="Predictive Branching API")


def _decode_image_from_base64(b64_str: str) -> np.ndarray:
    data = base64.b64decode(b64_str)
    img = Image.open(io.BytesIO(data)).convert("RGB")
    arr = np.array(img).astype("float32") / 255.0
    return arr


def _encode_image_to_base64(arr: np.ndarray) -> str:
    arr_u8 = (np.clip(arr, 0.0, 1.0) * 255).astype("uint8")
    pil_img = Image.fromarray(arr_u8, mode="RGB")
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


@app.post("/predictive_branch", response_model=PredictiveResponse)
def predictive_branch(req: PredictiveRequest):
    base_img = _decode_image_from_base64(req.image_base64)

    tmp_path = "tmp_base.png"
    save_image(base_img, tmp_path)

    history = EditHistory(base_image_path=tmp_path)
    for e in req.edits:
        history.add_edit(Edit(type=e.type, params=e.params, ai_improvable=e.ai_improvable))

    ai_full, ai_params, _ = run_predictive_branch(history, req.slide_index)

    ai_image_b64 = _encode_image_to_base64(ai_full)

    return PredictiveResponse(
        ai_image_base64=ai_image_b64,
        ai_params=ai_params,
    )
