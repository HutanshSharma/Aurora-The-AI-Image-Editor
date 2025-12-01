import numpy as np
from typing import Dict

from .intent import prepare_ai_inputs
from .ai_client import optimise_tone_colour
from .apply_edits import apply_brightness, apply_contrast
from .branching import render_original_future_branch
from .history import EditHistory
from .edits import Edit, BRIGHTNESS, CONTRAST

def apply_ai_params_fullres(img, ai_params):
    out = img.copy()
    out = apply_brightness(out, ai_params["brightness"])
    out = apply_contrast(out, ai_params["contrast"])

    # You will integrate real LUT model later.
    # For now, LUT does nothing but code path is ready.
    _ = ai_params.get("lut_strength", 0.0)

    return out

def apply_ai_edit_to_history(history: EditHistory,
                             slide_index: int,
                             ai_params: dict) -> EditHistory:
    """
    Creates a new history where:
      - all edits AFTER slide_index are removed
      - AI brightness + contrast edits are appended
    """

    # 1) Keep edits up to the branch point
    kept = history.get_edits_up_to_index(slide_index)

    # 2) Insert AI-improved edits (deltas)
    b = ai_params["brightness"]
    c = ai_params["contrast"]

    if abs(b) > 1e-6:
        kept.append(Edit(BRIGHTNESS, {"value": b}, ai_improvable=False))

    if abs(c) > 1e-6:
        kept.append(Edit(CONTRAST, {"value": c}, ai_improvable=False))

    # 3) New history object
    new_hist = EditHistory(
        base_image_path=history.base_image_path,
        edits=kept
    )

    return new_hist



def run_predictive_branch(history, slide_index: int):
    """
    Main pipeline:
       1. Build full-res + low-res + intent
       2. Call AI
       3. Apply AI params to full-res
       4. Return:
          - ai_image_full
          - ai_params
          - future_edits (original user edits after the branch)
    """

    # 1) Prepare inputs
    branch_full, lowres, intent_vec, future_edits, state_S, state_F = prepare_ai_inputs(
        history, slide_index
    )

    # 2) Call AI (stub or real API)
    ai_params = optimise_tone_colour(lowres, intent_vec)

    # 3) Apply AI params to FULL-RES
    ai_image_full = apply_ai_params_fullres(branch_full, ai_params)

    return ai_image_full, ai_params, future_edits

def run_predictive_branch_with_baseline(history, slide_index: int):
    """
    Returns BOTH:
      - ai_image_full   (AI-optimised future from the branch)
      - user_future_img (original future if user continued without AI)
      - ai_params
      - future_edits    (the original future edits list)
    """
    # user-only future from this slide
    user_future_img, future_edits = render_original_future_branch(history, slide_index)

    # AI future (uses your candidate search + heuristic)
    ai_image_full, ai_params, _ = run_predictive_branch(history, slide_index)

    return ai_image_full, user_future_img, ai_params, future_edits

def reject_ai_suggestion(history: EditHistory) -> EditHistory:
    """
    Rejecting the AI suggestion: simply return history unchanged.
    This keeps API consistent for UI and future extension.
    """
    return history

