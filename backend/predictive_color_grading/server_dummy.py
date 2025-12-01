import os
from src.hdrnet_wrapper import load_hdrnet_model, apply_hdrnet

from src.lut_utils import apply_cinematic_lut
from src.aesthetic_net import load_aesthetic_model, score_aesthetic

import base64
import io
from typing import List, Dict

import numpy as np
from PIL import Image
from flask import Flask, request, jsonify

from src.apply_edits import apply_brightness, apply_contrast

app = Flask(__name__)

HDRNET_WEIGHTS = os.environ.get("HDRNET_WEIGHTS", None)
load_hdrnet_model(HDRNET_WEIGHTS)


# Aesthetic model
AESTHETIC_WEIGHTS = os.environ.get("AESTHETIC_WEIGHTS", None)
load_aesthetic_model(AESTHETIC_WEIGHTS)

def _apply_lut_style(img: np.ndarray, strength: float) -> np.ndarray:
    """
    Wrapper to apply our cinematic 3D LUT with given strength.
    This is a stand-in for a learned 3D LUT model.
    """
    return apply_cinematic_lut(img, strength)


def _decode_image_from_base64(b64_str: str) -> np.ndarray:
    data = base64.b64decode(b64_str)
    img = Image.open(io.BytesIO(data)).convert("RGB")
    arr = np.asarray(img).astype(np.float32) / 255.0
    return arr


def _score_candidate(lowres_image: np.ndarray, cand: Dict[str, float]) -> float:
    img = lowres_image.copy()

    # 1) apply candidate brightness + contrast
    img = apply_brightness(img, cand["brightness"])
    img = apply_contrast(img,  cand["contrast"])

    # 2) HDRNet tone mapping
    img_tone = apply_hdrnet(img)

    # 3) LUT style
    lut_strength = float(cand.get("lut_strength", 0.0))
    img_styled = _apply_lut_style(img_tone, lut_strength)

    # 4) brightness/contrast heuristics (to avoid crazy outputs)
    y = 0.299 * img_styled[..., 0] + 0.587 * img_styled[..., 1] + 0.114 * img_styled[..., 2]
    mean = float(y.mean())
    std  = float(y.std())

    score_brightness = 1.0 - abs(mean - 0.5)
    score_contrast   = 1.0 - abs(std  - 0.25)

    # 5) NIMA-lite aesthetic score
    aest = score_aesthetic(img_styled)

    total = aest + 0.5 * score_brightness + 0.5 * score_contrast
    return float(total)







@app.route("/optimise", methods=["POST"])
def optimise():
    payload = request.get_json(force=True)

    lowres = _decode_image_from_base64(payload["image_base64"])
    candidates: List[Dict[str, float]] = payload["candidates"]

    best_idx = 0
    best_score = -1e9

    for i, cand in enumerate(candidates):
        score = _score_candidate(lowres, cand)
        if score > best_score:
            best_score = score
            best_idx = i

    best = candidates[best_idx]

    return jsonify({
    "best_index": best_idx,
    "brightness": float(best["brightness"]),
    "contrast":   float(best["contrast"]),
    "lut_strength": float(best.get("lut_strength", 0.0)),  # ADD THIS
    })



if __name__ == "__main__":
    print("Dummy server running at http://127.0.0.1:8000/optimise")
    app.run(host="0.0.0.0", port=8000)
