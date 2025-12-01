import numpy as np

from .history import EditHistory
from .apply_edits import load_image, apply_edits_sequence


def render_slide_image(history: EditHistory, slide_index: int) -> np.ndarray:
    """
    Render the image at a given slide index.
    slide_index = -1 -> base image (no edits)
    slide_index = 0  -> after first edit
    slide_index = 1  -> after second edit, etc.
    """
    base = load_image(history.base_image_path)
    if slide_index < 0:
        return base

    edits_up_to = history.get_edits_up_to_index(slide_index)
    return apply_edits_sequence(base, edits_up_to)


def render_original_future_branch(history: EditHistory, slide_index: int) -> tuple[np.ndarray, list]:
    """
    Render the 'original future branch' from a given slide.

    Returns:
        (future_image, future_edits_list)

    future_image is what you get if you take the image at slide_index
    and apply all edits after that index.
    """
    # 1. image at the selected slide
    current_img = render_slide_image(history, slide_index)

    # 2. edits after this slide
    future_edits = history.get_edits_from_index_exclusive(slide_index)

    if not future_edits:
        # no future edits; the 'future' is just the current image
        return current_img, future_edits

    # 3. apply future edits
    future_img = apply_edits_sequence(current_img, future_edits)
    return future_img, future_edits
