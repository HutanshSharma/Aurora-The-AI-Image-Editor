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
def _apply_s_curve(y: np.ndarray, strength: float = 0.4) -> np.ndarray:
    """
    Simple hand-crafted S-curve on luminance.

    y: float32 array in [0,1]
    strength: how strong the S-curve is (0 = no change, ~0.3–0.6 = subtle/medium)

    Idea:
      - Keep midtones near 0.5 mostly unchanged.
      - Slightly deepen shadows and highlights (more contrast) without hard clipping.
    """
    # ensure float and in [0,1]
    y = np.clip(y, 0.0, 1.0).astype("float32")

    # Center around mid-grey
    mid = 0.5
    x = y - mid  # now in [-0.5, +0.5]

    # Cubic-like S-curve: push values away from 0 in a smooth way
    # x' = x + strength * x^3 (odd function = symmetric around 0)
    x_prime = x + strength * (x ** 3)

    # Map back to [0,1]
    y_prime = np.clip(mid + x_prime, 0.0, 1.0)
    return y_prime


def _generate_candidates(intent_vector: np.ndarray) -> list[dict]:
    """
    From [Δb, Δc], create a small grid of candidate (brightness, contrast) deltas.

    - If the user pushed a parameter hard, we explore "backing off" and "going a bit further".
    - We keep everything clamped to safe ranges.
    """
    d_b, d_c = float(intent_vector[0]), float(intent_vector[1])

    # Scales around the user's delta.
    # We bias slightly toward "back off a bit" but still include slightly stronger.
    brightness_scales = [0.5, 0.75, 1.0, 1.25]
    contrast_scales   = [0.5, 0.75, 1.0, 1.25]

    candidates: list[dict] = []

    for sb in brightness_scales:
        for sc in contrast_scales:
            cand_b = d_b * sb
            cand_c = d_c * sc

            # clamp to safe ranges (tune later if needed)
            cand_b = max(-0.5, min(0.5, cand_b))
            cand_c = max(-0.5, min(0.5, cand_c))

            
            # Respect user direction: don't flip sign relative to original Δ
            def same_sign_or_zero(x, ref, eps=1e-3):
              # If user change is tiny, allow both directions (no strong intent)
              if abs(ref) < eps:
                return x
              # If cand goes opposite sign, snap it to 0 (no change) in that axis
              if ref > 0 and x < 0:
                return 0.0
              if ref < 0 and x > 0:
                return 0.0
              return x

            cand_b = same_sign_or_zero(cand_b, d_b)
            cand_c = same_sign_or_zero(cand_c, d_c)

            candidates.append({
                "brightness": cand_b,
                "contrast":   cand_c,
                # keep LUT for future expansion; 0.0 = no extra style for now
                "lut_strength": 0.0,
            })

    # Optional: de-duplicate if many entries collapse to the same values
    unique = []
    seen = set()
    for c in candidates:
        key = (round(c["brightness"], 4), round(c["contrast"], 4), round(c["lut_strength"], 4))
        if key not in seen:
            seen.add(key)
            unique.append(c)

    return unique




def _score_candidate(lowres_image: np.ndarray, cand: Dict[str, float]) -> float:
    """
    Heuristic scoring of one candidate:

      1) Apply brightness + contrast.
      2) Apply a gentle S-curve to luminance (simulated tone net).
      3) Compute stats on curved luminance.
      4) Measure saturation.
      5) Penalise heavy clipping in shadows/highlights.
      6) Prefer midtones around 0.5 and moderate contrast.
    """
    # 1) Apply tone changes
    img = lowres_image.copy()
    img = apply_brightness(img, cand["brightness"])
    img = apply_contrast(img,  cand["contrast"])
    img = np.clip(img, 0.0, 1.0)

    # 2) Luminance (linear Rec.601)
    y_lin = 0.299 * img[..., 0] + 0.587 * img[..., 1] + 0.114 * img[..., 2]

    # 2b) Apply S-curve to luminance before scoring
    y = _apply_s_curve(y_lin, strength=0.4)

    # 3) Basic stats on curved luminance
    mean = float(y.mean())
    std  = float(y.std())

    # 4) Saturation (same as before)
    grey = img.mean(axis=2, keepdims=True)
    sat_map = np.abs(img - grey)
    sat_mean = float(sat_map.mean())

    # 5) Clipping: fraction near 0 or 1 on curved luminance
    clip_shadows    = float((y < 0.02).mean())
    clip_highlights = float((y > 0.98).mean())

    # 6) Sub-scores (same idea as before)

    # Midtone preference around 0.5
    score_midtone = 1.0 - min(1.0, abs(mean - 0.5) * 2.0)

    # Contrast preference around ~0.25
    score_contrast = 1.0 - min(1.0, abs(std - 0.25) * 4.0)

    # Saturation: prefer moderate
    score_sat_center = 1.0 - min(1.0, abs(sat_mean - 0.25) * 4.0)
    sat_penalty = max(0.0, sat_mean - 0.4) * 4.0

    # Clipping penalty (shadows + highlights)
    clip_penalty = (clip_shadows + clip_highlights) * 5.0

    # 7) Combine
    score = 0.0
    score += 2.0 * score_midtone
    score += 1.5 * score_contrast
    score += 0.5 * score_sat_center

    score -= sat_penalty
    score -= clip_penalty

    return float(score)






def optimise_tone_colour(lowres_image: np.ndarray,
                         intent_vector: np.ndarray) -> Dict[str, float]:
    """
    Pure local optimisation:

      - Build a candidate set that includes the user's original future delta.
      - Score all candidates on low-res image.
      - Only override user if AI finds a meaningfully better option.
    """
    d_b, d_c = float(intent_vector[0]), float(intent_vector[1])

    # User's original future delta as baseline candidate
    user_cand = {
        "brightness": max(-0.5, min(0.5, d_b)),
        "contrast":   max(-0.5, min(0.5, d_c)),
        "lut_strength": 0.0,
    }

    # Generate neighbours around user's delta
    neighbours = _generate_candidates(intent_vector)

    # Ensure user candidate is included at index 0 and remove duplicates
    candidates: list[dict] = []
    seen = set()

    def add_unique(c: dict):
        key = (round(c["brightness"], 4), round(c["contrast"], 4), round(c.get("lut_strength", 0.0), 4))
        if key not in seen:
            seen.add(key)
            candidates.append(c)

    add_unique(user_cand)
    for c in neighbours:
        add_unique(c)

    # Score all candidates
    best_score = -1e9
    best_idx = 0

    # Also remember the user's score
    user_score = None

    for idx, cand in enumerate(candidates):
        score = _score_candidate(lowres_image, cand)
        if idx == 0:
            user_score = score  # baseline
        if score > best_score:
            best_score = score
            best_idx = idx

    assert user_score is not None

    # Require AI to beat user by a margin, else keep user's parameters
    IMPROVEMENT_MARGIN = 0.1  # tune later if needed
    if best_idx != 0 and best_score < user_score + IMPROVEMENT_MARGIN:
        # AI didn't find a clearly better option → respect user
        chosen = candidates[0]
    else:
        chosen = candidates[best_idx]

    return {
        "brightness": float(chosen["brightness"]),
        "contrast":   float(chosen["contrast"]),
    }
