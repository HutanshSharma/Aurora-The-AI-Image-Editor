"""
Modal Client Helper
===================
This file helps you test and interact with your deployed Modal servers.
It provides easy-to-use functions to call your inpainting endpoints.

Usage:
1. Deploy your Modal servers first (see DEPLOYMENT_GUIDE.txt)
2. Update MODAL_URLS below with your actual Modal endpoints
3. Run this script to test: python test_modal_client.py
"""

import requests
import base64
import io
from PIL import Image
import numpy as np
from typing import Optional


# ========================================
# CONFIGURATION - UPDATE THESE URLS!
# ========================================
# After deploying, Modal gives you URLs like:
# https://username--app-name-endpoint-name.modal.run

MODAL_URLS = {
    # Qwen endpoints
    "qwen_white_to_scene": "https://teamadobe39--qwen-image-edit-server-white-to-scene-endpoint.modal.run",
    "qwen_fusion": "https://teamadobe39--qwen-image-edit-server-fusion-endpoint.modal.run",
    
    # SDXL endpoint
    "sdxl_inpaint": "https://teamadobe39--sdxl-inpainting-server-inpaint-endpoint.modal.run",
    
    # Health check endpoints
    "qwen_health": "https://teamadobe39--qwen-image-edit-server-health.modal.run",
    "sdxl_health": "https://teamadobe39--sdxl-inpainting-server-health.modal.run",
}


# ========================================
# HELPER FUNCTIONS
# ========================================

def image_to_base64(image_path: str) -> str:
    """
    Convert image file to base64 string.
    
    Args:
        image_path: Path to image file
    
    Returns:
        Base64 encoded string with data URI prefix
    """
    with Image.open(image_path) as img:
        img = img.convert("RGB")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{img_base64}"


def numpy_to_base64(image_array: np.ndarray) -> str:
    """
    Convert numpy array to base64 string.
    
    Args:
        image_array: Numpy array (H, W, C) or (H, W) for grayscale
    
    Returns:
        Base64 encoded string with data URI prefix
    """
    img = Image.fromarray(image_array.astype(np.uint8))
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{img_base64}"


def base64_to_image(base64_string: str) -> Image.Image:
    """
    Convert base64 string to PIL Image.
    
    Args:
        base64_string: Base64 encoded image (with or without data URI prefix)
    
    Returns:
        PIL Image object
    """
    # Remove data URI prefix if present
    if "," in base64_string:
        base64_string = base64_string.split(",")[1]
    
    img_bytes = base64.b64decode(base64_string)
    return Image.open(io.BytesIO(img_bytes))


def check_health(service: str = "all") -> dict:
    """
    Check if Modal services are healthy.
    
    Args:
        service: "qwen", "sdxl", or "all"
    
    Returns:
        Dictionary with health status
    """
    results = {}
    
    if service in ["qwen", "all"]:
        try:
            response = requests.get(MODAL_URLS["qwen_health"], timeout=10)
            results["qwen"] = response.json()
        except Exception as e:
            results["qwen"] = {"status": "error", "message": str(e)}
    
    if service in ["sdxl", "all"]:
        try:
            response = requests.get(MODAL_URLS["sdxl_health"], timeout=10)
            results["sdxl"] = response.json()
        except Exception as e:
            results["sdxl"] = {"status": "error", "message": str(e)}
    
    return results


# ========================================
# QWEN EDITING FUNCTIONS
# ========================================

def qwen_white_to_scene(
    image_path: str,
    mask_path: str,
    prompt: str,
    negative_prompt: str = "blurry, low quality, distorted",
    num_inference_steps: int = 30,
    guidance_scale: float = 7.5,
    strength: float = 0.8,
    save_output: Optional[str] = None,
) -> Image.Image:
    """
    Use Qwen's white-to-scene LoRA to convert white backgrounds to scenes.
    
    Args:
        image_path: Path to input image
        mask_path: Path to mask image (white = edit region)
        prompt: Description of desired scene
        negative_prompt: What to avoid
        num_inference_steps: Quality (higher = better, slower)
        guidance_scale: Prompt strength
        strength: Edit intensity
        save_output: Optional path to save result
    
    Returns:
        PIL Image with edited result
    """
    print(f"🎨 Qwen White-to-Scene: '{prompt}'")
    
    # Prepare request
    payload = {
        "image_base64": image_to_base64(image_path),
        "mask_base64": image_to_base64(mask_path),
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "num_inference_steps": num_inference_steps,
        "guidance_scale": guidance_scale,
        "strength": strength,
    }
    
    # Call Modal endpoint
    print("📤 Sending request to Modal...")
    response = requests.post(
        MODAL_URLS["qwen_white_to_scene"],
        json=payload,
        timeout=120,  # 2 minute timeout
    )
    
    if response.status_code != 200:
        raise Exception(f"Request failed: {response.status_code} - {response.text}")
    
    result = response.json()
    print("✅ Edit complete!")
    
    # Convert result to image
    result_image = base64_to_image(result["image_base64"])
    
    if save_output:
        result_image.save(save_output)
        print(f"💾 Saved to: {save_output}")
    
    return result_image


def qwen_fusion(
    image_path: str,
    mask_path: str,
    prompt: str,
    negative_prompt: str = "blurry, low quality, distorted",
    num_inference_steps: int = 30,
    guidance_scale: float = 7.5,
    strength: float = 0.8,
    save_output: Optional[str] = None,
) -> Image.Image:
    """
    Use Qwen's fusion LoRA for seamless image blending.
    
    Args:
        image_path: Path to input image
        mask_path: Path to mask image
        prompt: What to add/blend
        negative_prompt: What to avoid
        num_inference_steps: Quality
        guidance_scale: Prompt strength
        strength: Edit intensity
        save_output: Optional save path
    
    Returns:
        PIL Image with edited result
    """
    print(f"🎨 Qwen Fusion: '{prompt}'")
    
    payload = {
        "image_base64": image_to_base64(image_path),
        "mask_base64": image_to_base64(mask_path),
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "num_inference_steps": num_inference_steps,
        "guidance_scale": guidance_scale,
        "strength": strength,
    }
    
    print("📤 Sending request to Modal...")
    response = requests.post(
        MODAL_URLS["qwen_fusion"],
        json=payload,
        timeout=120,
    )
    
    if response.status_code != 200:
        raise Exception(f"Request failed: {response.status_code} - {response.text}")
    
    result = response.json()
    print("✅ Edit complete!")
    
    result_image = base64_to_image(result["image_base64"])
    
    if save_output:
        result_image.save(save_output)
        print(f"💾 Saved to: {save_output}")
    
    return result_image


# ========================================
# SDXL INPAINTING FUNCTION
# ========================================

def sdxl_inpaint(
    image_path: str,
    mask_path: str,
    prompt: str,
    negative_prompt: str = "blurry, low quality, distorted, ugly",
    num_inference_steps: int = 40,
    guidance_scale: float = 7.5,
    strength: float = 0.99,
    lora_name: Optional[str] = None,
    save_output: Optional[str] = None,
) -> Image.Image:
    """
    Use SDXL for high-quality mask-based inpainting.
    
    Args:
        image_path: Path to input image
        mask_path: Path to mask (white = inpaint region)
        prompt: What to generate in masked area
        negative_prompt: What to avoid
        num_inference_steps: Quality (30-50 recommended)
        guidance_scale: Prompt adherence
        strength: Edit intensity (keep 0.99 for inpainting)
        lora_name: Optional custom LoRA name
        save_output: Optional save path
    
    Returns:
        PIL Image with inpainted result
    """
    print(f"🎨 SDXL Inpainting: '{prompt}'")
    if lora_name:
        print(f"   Using LoRA: {lora_name}")
    
    payload = {
        "image_base64": image_to_base64(image_path),
        "mask_base64": image_to_base64(mask_path),
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "num_inference_steps": num_inference_steps,
        "guidance_scale": guidance_scale,
        "strength": strength,
    }
    
    if lora_name:
        payload["lora_name"] = lora_name
    
    print("📤 Sending request to Modal...")
    response = requests.post(
        MODAL_URLS["sdxl_inpaint"],
        json=payload,
        timeout=120,
    )
    
    if response.status_code != 200:
        raise Exception(f"Request failed: {response.status_code} - {response.text}")
    
    result = response.json()
    print("✅ Inpainting complete!")
    
    result_image = base64_to_image(result["image_base64"])
    
    if save_output:
        result_image.save(save_output)
        print(f"💾 Saved to: {save_output}")
    
    return result_image


# ========================================
# TESTING CODE
# ========================================

if __name__ == "__main__":
    """
    Example usage and testing.
    
    Before running:
    1. Deploy your Modal servers
    2. Update MODAL_URLS above with your actual URLs
    3. Make sure you have test images ready
    """
    
    print("=" * 60)
    print("MODAL CLIENT TESTER")
    print("=" * 60)
    
    # Check if URLs are configured
    if "YOUR-USERNAME" in MODAL_URLS["qwen_white_to_scene"]:
        print("\n⚠️  WARNING: You need to update MODAL_URLS with your actual Modal endpoints!")
        print("   1. Deploy your Modal servers first")
        print("   2. Copy the URLs from Modal")
        print("   3. Update MODAL_URLS in this file")
        print("   4. Run this script again")
        exit(1)
    
    # Test 1: Health Checks
    print("\n📊 Testing health endpoints...")
    health = check_health("all")
    print(f"   Qwen: {health.get('qwen', {}).get('status', 'unknown')}")
    print(f"   SDXL: {health.get('sdxl', {}).get('status', 'unknown')}")
    
    # Test 2: Check if test images exist
    import os
    if not os.path.exists("cat.jpg"):
        print("\n⚠️  Test image 'cat.jpg' not found. Please run app.ipynb first to download it.")
        exit(1)
    
    if not os.path.exists("test_mask_output.png"):
        print("\n⚠️  Mask 'test_mask_output.png' not found. Generate a mask first using segmentation.")
        exit(1)
    
    # Test 3: Qwen White-to-Scene
    print("\n" + "=" * 60)
    print("TEST 1: Qwen White-to-Scene")
    print("=" * 60)
    try:
        result = qwen_white_to_scene(
            image_path="cat.jpg",
            mask_path="test_mask_output.png",
            prompt="cozy living room with plants and warm lighting",
            save_output="test_qwen_white_to_scene.png",
        )
        print("✅ Test passed!")
    except Exception as e:
        print(f"❌ Test failed: {e}")
    
    # Test 4: Qwen Fusion
    print("\n" + "=" * 60)
    print("TEST 2: Qwen Fusion")
    print("=" * 60)
    try:
        result = qwen_fusion(
            image_path="cat.jpg",
            mask_path="test_mask_output.png",
            prompt="magical glowing aura around the cat",
            save_output="test_qwen_fusion.png",
        )
        print("✅ Test passed!")
    except Exception as e:
        print(f"❌ Test failed: {e}")
    
    # Test 5: SDXL Inpainting
    print("\n" + "=" * 60)
    print("TEST 3: SDXL Inpainting")
    print("=" * 60)
    try:
        result = sdxl_inpaint(
            image_path="cat.jpg",
            mask_path="test_mask_output.png",
            prompt="fluffy white puppy",
            num_inference_steps=40,
            save_output="test_sdxl_inpaint.png",
        )
        print("✅ Test passed!")
    except Exception as e:
        print(f"❌ Test failed: {e}")
    
    print("\n" + "=" * 60)
    print("ALL TESTS COMPLETE!")
    print("=" * 60)
    print("\nCheck the output files:")
    print("  - test_qwen_white_to_scene.png")
    print("  - test_qwen_fusion.png")
    print("  - test_sdxl_inpaint.png")
