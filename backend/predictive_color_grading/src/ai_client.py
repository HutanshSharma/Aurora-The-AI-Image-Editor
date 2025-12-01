import os
import base64
import json
from typing import Dict, List

import numpy as np
import requests
from PIL import Image
import io

from .apply_edits import apply_brightness, apply_contrast

"""
Modal / server API contract (planned):

POST /optimise

Request JSON:
{
  "image_base64": "<PNG of low-res RGB image>",
  "candidates": [
    { "brightness": float, "contrast": float, "lut_strength": float }
  ],
  "intent_vector": [Δbrightness, Δcontrast, Δlut_strength]
}

Response JSON:
{
  "best_index": int,
  "brightness": float,
  "contrast": float,
  "lut_strength": float
}
"""


def _encode_image_to_base64(img: np.ndarray) -> str:
    """
    img: float32 in [0,1], shape (H, W, 3)
    returns: base64-encoded PNG string
    """
    img_u8 = (np.clip(img, 0.0, 1.0) * 255).astype("uint8")
    pil_img = Image.fromarray(img_u8, mode="RGB")
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def _generate_candidates(intent_vector: np.ndarray) -> list[dict]:
    d_b, d_c = float(intent_vector[0]), float(intent_vector[1])

    scales = [0.5, 0.75, 1.0, 1.25, 1.5]

    candidates = []
    for s in scales:
        cand_b = d_b * s
        cand_c = d_c * s

        cand_b = max(-0.5, min(0.5, cand_b))
        cand_c = max(-0.5, min(0.5, cand_c))

        candidates.append({
            "brightness": cand_b,
            "contrast":   cand_c,
            "lut_strength": 0.0   # ADD THIS
        })

    return candidates



def _score_candidate(lowres_image: np.ndarray, cand: Dict[str, float]) -> float:
    """
    Very simple heuristic:
      - apply brightness+contrast
      - compute mean + std of luminance
      - prefer mid-brightness (~0.5) and moderate contrast (std ~0.2–0.3)
    """
    img = lowres_image.copy()
    img = apply_brightness(img, cand["brightness"])
    img = apply_contrast(img, cand["contrast"])

    # luminance approx
    y = 0.299 * img[..., 0] + 0.587 * img[..., 1] + 0.114 * img[..., 2]
    mean = float(y.mean())
    std = float(y.std())

    # want mean near 0.5, std near 0.25
    score_brightness = 1.0 - abs(mean - 0.5)  # closer to 0.5 is better
    score_contrast = 1.0 - abs(std - 0.25)

    return score_brightness + score_contrast  # rough combo


USE_SERVER = True  # set True when using HTTP server / Modal


def optimise_tone_colour(lowres_image: np.ndarray,
                         intent_vector: np.ndarray) -> Dict[str, float]:
    """
    If USE_SERVER = True:
      - send low-res image + candidates + intent_vector to HTTP server (future Modal)
    Else:
      - use local heuristic candidate search (current logic).
    """
    candidates = _generate_candidates(intent_vector)

    if USE_SERVER:
        # --- future server path ---
        payload = {
            "image_base64": _encode_image_to_base64(lowres_image),
            "candidates": [
                {
                    "brightness": float(c["brightness"]),
                    "contrast": float(c["contrast"]),
                    "lut_strength": float(c.get("lut_strength", 0.0)),
                }
                for c in candidates
            ],
            "intent_vector": intent_vector.tolist(),
        }

        api_url = os.environ.get("AI_API_URL", "http://localhost:8000/optimise")
        headers = {"Content-Type": "application/json"}

        resp = requests.post(
            api_url, headers=headers, data=json.dumps(payload), timeout=10
        )
        resp.raise_for_status()
        data = resp.json()

        return {
            "brightness": float(data["brightness"]),
            "contrast": float(data["contrast"]),
            # "lut_strength": float(data["lut_strength"]),  # later, when we use LUT
        }

    # --- local heuristic fallback (what you already had) ---
    best_score = -1e9
    best_cand = candidates[0]

    for cand in candidates:
        score = _score_candidate(lowres_image, cand)
        if score > best_score:
            best_score = score
            best_cand = cand

    return {
        "brightness": float(best_cand["brightness"]),
        "contrast": float(best_cand["contrast"]),
    }
