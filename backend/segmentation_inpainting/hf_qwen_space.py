import os
from PIL import Image
from dotenv import load_dotenv

load_dotenv()
HF_TOKEN = os.getenv("HF_TOKEN")
HF_SPACE = os.getenv("HF_SPACE", "team39/qwen-relight-2509")

_client = None
_handle_file = None

AVAILABLE_ADAPTERS = [
    'Photo-to-Anime', 'Multiple-Angles', 'Light-Restoration',
    'Multi-Angle-Lighting', 'Upscale-Image', 'Relight',
    'Next-Scene', 'Edit-Skin'
]


def _init_client():
    """Connect to the HF Space, reusing an existing connection if we have one.

    Returns the gradio client, or None if there's no HF_TOKEN or the connection
    fails (so callers fall back to the "not available" path and can retry later).
    """
    global _client, _handle_file
    if _client is not None:
        return _client
    if not HF_TOKEN:
        print("[QWEN] HF_TOKEN not set — AI editing disabled.")
        return None

    try:
        from gradio_client import Client, handle_file
        _handle_file = handle_file
        _client = Client(HF_SPACE, token=HF_TOKEN)
        print(f"[QWEN] Connected to HF Space: {HF_SPACE}")
    except Exception as e:
        print(f"[QWEN] HF Space connection failed: {e}")
        _client = None
    return _client


def is_available():
    """True when remote AI editing is configured and reachable."""
    return _init_client() is not None


def get_best_adapter(prompt: str, default_adapter: str = "Relight"):
    """Pick the LoRA adapter that best matches the user's prompt."""
    p = prompt.lower()
    if any(k in p for k in ['background', 'scene', 'environment', 'setting', 'place']):
        return 'Next-Scene'
    if any(k in p for k in ['light', 'lighting', 'illuminate', 'shadow', 'bright', 'dark', 'golden hour', 'sunset']):
        return 'Relight'
    if any(k in p for k in ['skin', 'face', 'portrait', 'complexion']):
        return 'Edit-Skin'
    if any(k in p for k in ['anime', 'cartoon', 'animated']):
        return 'Photo-to-Anime'
    if any(k in p for k in ['enhance', 'improve', 'upscale', 'quality']):
        return 'Upscale-Image'
    if any(k in p for k in ['restore', 'fix', 'repair']):
        return 'Light-Restoration'
    return default_adapter


def _infer(image_path: str, prompt: str, adapter: str):
    """Run one inference on the Space and return the result as a PIL image."""
    client = _init_client()
    if client is None:
        raise RuntimeError("AI editing is not available")
    result = client.predict(
        input_image=_handle_file(image_path),
        prompt=prompt,
        lora_adapter=adapter,
        seed=0,
        randomize_seed=True,
        guidance_scale=1.0,
        steps=4,
        api_name="/infer",
    )
    return Image.open(result[0])


def smart_edit(image_path: str, prompt: str):
    """Route the prompt to the best adapter, falling back to Relight on error."""
    adapter = get_best_adapter(prompt)
    try:
        return _infer(image_path, prompt, adapter)
    except Exception as e:
        if adapter != "Relight":
            print(f"[QWEN] Adapter '{adapter}' failed ({e}); retrying with Relight")
            return _infer(image_path, prompt, "Relight")
        raise
