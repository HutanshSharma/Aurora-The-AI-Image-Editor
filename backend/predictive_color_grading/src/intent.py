import numpy as np
from dataclasses import dataclass
from typing import List, Tuple
from PIL import Image

from .edits import Edit, BRIGHTNESS, CONTRAST
from .history import EditHistory
from .branching import render_slide_image


# --- Tone state ---------------------------------------------------------

from typing import Optional

@dataclass
class ToneState:
    brightness: float
    contrast: float
    lut_id: Optional[str] = None
    lut_strength: float = 0.0



from .edits import Edit, BRIGHTNESS, CONTRAST, FILTER

def compute_tone_state(edits: List[Edit]) -> ToneState:
    state = ToneState(
        brightness=0.0,
        contrast=1.0,
        lut_id=None,
        lut_strength=0.0,
    )

    for e in edits:
        if e.type == BRIGHTNESS:
            state.brightness = e.params["value"]
        elif e.type == CONTRAST:
            state.contrast = e.params["value"]
        elif e.type == FILTER:  # treat FILTER as LUT
            state.lut_id = e.params.get("id")
            state.lut_strength = e.params.get("strength", 1.0)

    return state



# --- Low-res helper -----------------------------------------------------

TARGET_LONG_SIDE = 256  # or 320/512 if you wish


def make_lowres(img: np.ndarray, target_long_side: int = TARGET_LONG_SIDE) -> np.ndarray:
    """
    img: float32 [0,1], shape (H, W, 3)
    returns: float32 [0,1], shape (h_low, w_low, 3)
    """
    h, w, _ = img.shape
    long_side = max(h, w)
    if long_side <= target_long_side:
        return img.copy()

    scale = target_long_side / long_side
    new_w = int(round(w * scale))
    new_h = int(round(h * scale))

    img_u8 = (np.clip(img, 0.0, 1.0) * 255).astype("uint8")
    pil_img = Image.fromarray(img_u8, mode="RGB")
    pil_low = pil_img.resize((new_w, new_h), Image.BILINEAR)
    low_arr = np.asarray(pil_low).astype(np.float32) / 255.0
    return low_arr


# --- Intent vector ------------------------------------------------------

def compute_intent_vector(state_S: ToneState, state_F: ToneState) -> np.ndarray:
    d_brightness  = state_F.brightness   - state_S.brightness
    d_contrast    = state_F.contrast     - state_S.contrast
    d_lut_strength = state_F.lut_strength - state_S.lut_strength

    return np.array([d_brightness, d_contrast, d_lut_strength], dtype=np.float32)



# --- High-level prep for AI --------------------------------------------

def prepare_ai_inputs(
    history: EditHistory,
    slide_index: int,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, list[Edit], ToneState, ToneState]:
    """
    High-level helper:
      - renders branch image at slide_index (full-res)
      - computes tone states at branch (S) and final (F)
      - downsamples to low-res
      - builds intent vector

    Returns:
      branch_image_full
      branch_image_low
      intent_vector
      future_edits
      state_S
      state_F
    """
    # 1) full-res branch image
    branch_image_full = render_slide_image(history, slide_index)

    # 2) split edits
    branch_edits = history.get_edits_up_to_index(slide_index)
    future_edits = history.get_edits_from_index_exclusive(slide_index)

    # 3) tone states
    state_S = compute_tone_state(branch_edits)
    state_F = compute_tone_state(history.edits)

    # 4) low-res proxy
    branch_image_low = make_lowres(branch_image_full)

    # 5) intent vector
    intent_vector = compute_intent_vector(state_S, state_F)

    return branch_image_full, branch_image_low, intent_vector, future_edits, state_S, state_F
