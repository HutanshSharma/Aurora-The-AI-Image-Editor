import numpy as np
from PIL import Image
from .edits import BRIGHTNESS, CONTRAST, SATURATION, TEMPERATURE, FILTER

def load_image(path):
    img = Image.open(path).convert("RGB")
    return np.array(img).astype(np.float32) / 255.0

def save_image(arr, path):
    arr = np.clip(arr * 255.0, 0, 255).astype(np.uint8)
    Image.fromarray(arr).save(path)

def apply_brightness(img, value):
    return np.clip(img + value, 0.0, 1.0)

def apply_contrast(img, value):
    factor = 1.0 + value
    return np.clip((img - 0.5) * factor + 0.5, 0.0, 1.0)

def apply_saturation(img, value):
    grey = img.mean(axis=2, keepdims=True)
    factor = 1.0 + value
    return np.clip(grey + (img - grey) * factor, 0.0, 1.0)

def apply_temperature(img, value):
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    r = np.clip(r + value * 0.1, 0.0, 1.0)
    b = np.clip(b - value * 0.1, 0.0, 1.0)
    return np.stack([r, g, b], axis=-1)

def apply_filter(img, filter_id, strength):
    if filter_id == "WarmFilm03":
        warm = apply_temperature(img, 0.5)
        faded = np.clip(warm + 0.05, 0.0, 1.0)
        return img * (1 - strength) + faded * strength
    return img

def apply_edits_sequence(img, edits):
    out = img.copy()
    for e in edits:
        if e.type == BRIGHTNESS:
            out = apply_brightness(out, e.params["value"])
        elif e.type == CONTRAST:
            out = apply_contrast(out, e.params["value"])
        elif e.type == SATURATION:
            out = apply_saturation(out, e.params["value"])
        elif e.type == TEMPERATURE:
            out = apply_temperature(out, e.params["value"])
        elif e.type == FILTER:
            out = apply_filter(out, e.params["id"], e.params.get("strength", 1.0))
    return out
