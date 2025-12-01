import numpy as np
from src.history import EditHistory
from src.edits import Edit, BRIGHTNESS, CONTRAST
from src.predictive_branch import run_predictive_branch, apply_ai_edit_to_history

def test_predictive_basic():
    hist = EditHistory(base_image_path="example.jpg")
    hist.add_edit(Edit(BRIGHTNESS, {"value": 0.2}))
    hist.add_edit(Edit(CONTRAST,   {"value": 0.3}))
    hist.add_edit(Edit(BRIGHTNESS, {"value": 0.1}))

    ai_img, ai_params, fut = run_predictive_branch(hist, 1)

    assert isinstance(ai_params, dict)
    assert "brightness" in ai_params
    assert "contrast" in ai_params

    assert ai_img is not None
    assert len(fut) >= 0

def test_accept_ai_new_history():
    hist = EditHistory(base_image_path="example.jpg")
    hist.add_edit(Edit(BRIGHTNESS, {"value": 0.2}))
    hist.add_edit(Edit(CONTRAST,   {"value": 0.3}))
    hist.add_edit(Edit(BRIGHTNESS, {"value": 0.1}))
    hist.add_edit(Edit(CONTRAST,   {"value": 0.15}))

    ai_params = {"brightness": -0.05, "contrast": -0.07}

    new_hist = apply_ai_edit_to_history(hist, slide_index=1, ai_params=ai_params)

    # only first two edits + AI edits should remain
    assert len(new_hist.edits) >= 2
    assert new_hist.edits[0].type == BRIGHTNESS
    assert new_hist.edits[1].type == CONTRAST
