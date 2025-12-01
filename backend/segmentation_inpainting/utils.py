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

def extract_object_with_transparency(image_array, mask_array):
    """
    Extract the masked region from image with transparent background.
    
    Args:
        image_array: NumPy RGB array (H, W, 3)
        mask_array: NumPy boolean array (H, W) - True for object, False for background
    
    Returns:
        PIL Image with RGBA (transparent background where mask is False)
    """
    # Convert RGB to RGBA
    image_rgba = np.dstack((image_array, np.ones(image_array.shape[:2], dtype=np.uint8) * 255))
    
    # Set alpha channel to 0 where mask is False (make background transparent)
    image_rgba[:, :, 3] = (mask_array * 255).astype(np.uint8)
    
    # Convert to PIL Image
    return Image.fromarray(image_rgba, mode='RGBA')

def encode_image_to_base64(image):
    """
    Encode PIL Image to base64 string.
    
    Args:
        image: PIL Image (RGB or RGBA)
    
    Returns:
        Base64 encoded string
    """
    buffered = io.BytesIO()
    image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")

def place_object_on_background(object_rgba, background_rgb=None, background_color=(255, 255, 255)):
    """
    Place transparent object on a background.
    
    Args:
        object_rgba: PIL Image with transparency (RGBA)
        background_rgb: Optional PIL Image background (RGB). If None, uses solid color.
        background_color: Tuple (R, G, B) for solid background if background_rgb is None
    
    Returns:
        PIL Image (RGB) - composite image
    """
    # Create or use background
    if background_rgb is None:
        # Create solid color background
        background = Image.new('RGB', object_rgba.size, background_color)
    else:
        # Resize background to match object size if needed
        background = background_rgb.convert('RGB')
        if background.size != object_rgba.size:
            background = background.resize(object_rgba.size, Image.LANCZOS)
    
    # Paste object onto background using alpha channel as mask
    background.paste(object_rgba, (0, 0), object_rgba)
    
    return background