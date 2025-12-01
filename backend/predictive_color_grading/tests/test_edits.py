import numpy as np

from src.apply_edits import apply_brightness


def test_brightness():
    img = np.ones((2, 2, 3), dtype=np.float32) * 0.5
    out = apply_brightness(img, 0.2)
    assert np.allclose(out, 0.7)
