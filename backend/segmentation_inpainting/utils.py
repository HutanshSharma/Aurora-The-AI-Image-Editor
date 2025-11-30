import base64, io
from PIL import Image
import numpy as np

def decode_base64_image(base64_string):
    """Converts base64 string to NumPy RGB array."""
    if "," in base64_string:
        base64_string = base64_string.split(",")[1]
    image_data = base64.b64decode(base64_string)
    image = Image.open(io.BytesIO(image_data)).convert("RGB")
    return np.array(image)

def encode_mask_to_base64(mask_array):
    """Converts boolean mask to base64 PNG."""
    mask_uint8 = (mask_array * 255).astype(np.uint8)
    image = Image.fromarray(mask_uint8)
    buffered = io.BytesIO()
    image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")