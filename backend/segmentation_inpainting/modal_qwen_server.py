"""
Modal Server for Qwen Image Editing Models
===========================================
This script deploys Qwen-Edit-2509 model with two LoRAs on Modal:
1. dx8152/Qwen-Image-Edit-2509-White_to_Scene (for white background to scene)
2. dx8152/Qwen-Image-Edit-2509-Fusion (for image fusion/blending)

Modal automatically handles:
- Model downloading and caching
- GPU provisioning (A100 recommended for this model)
- HTTP endpoint creation
- Auto-scaling based on requests

Setup Instructions:
1. Install Modal: pip install modal
2. Set up Modal token: modal token new
3. Deploy this app: modal deploy modal_qwen_server.py
4. Modal will give you a public URL endpoint

No need to manually download/upload models - Modal's image builder does it automatically!
"""

import modal
import io
import base64
from pathlib import Path

# Create Modal app instance
app = modal.App("qwen-image-edit-server")

# Define the Docker image with all dependencies
# Modal will build this image once and cache it
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch==2.1.0",
        "torchvision==0.16.0",
        "transformers>=4.37.0",
        "diffusers>=0.25.0",
        "accelerate>=0.25.0",
        "peft>=0.8.0",  # For LoRA support
        "pillow>=10.0.0",
        "numpy>=1.24.0",
        "safetensors>=0.4.0",
        "fastapi",  # Required for web endpoints
    )
)

# Define GPU configuration
# Using A10G for cost efficiency - A100 is 5x more expensive
# For a demo/development, A10G is sufficient (change to this a100 in final demo)
GPU_CONFIG = "a10g"

# Model and LoRA configurations
QWEN_MODEL_ID = "Qwen/Qwen-Edit-2509"  # Base model
LORA_WHITE_TO_SCENE = "dx8152/Qwen-Image-Edit-2509-White_to_Scene"
LORA_FUSION = "dx8152/Qwen-Image-Edit-2509-Fusion"


@app.cls(
    image=image,
    gpu=GPU_CONFIG,
    timeout=600,  # 10 minutes timeout for long-running inference
    scaledown_window=120,  # Keep warm for 2 minutes (cost optimization)
)
@modal.concurrent(max_inputs=1)  # Avoid race conditions with diffusers pipeline
class QwenImageEditor:
    """
    Modal class that handles Qwen model inference with LoRA switching.
    
    The @enter method runs once when the container starts (model loading).
    The @method decorators create HTTP endpoints for inference.
    """
    
    @modal.enter()  # Runs during container startup to load models
    def download_models(self):
        """
        Pre-download models during image build phase.
        This makes cold starts faster since models are already cached.
        """
        from transformers import AutoModel, AutoTokenizer
        from diffusers import AutoPipelineForImage2Image
        
        print("📥 Downloading Qwen base model...")
        # This downloads and caches the base model
        AutoModel.from_pretrained(
            QWEN_MODEL_ID,
            trust_remote_code=True,
            cache_dir="/cache"
        )
        
        print("📥 Downloading LoRA adapters...")
        # Pre-download LoRA weights (they're small, ~100MB each)
        for lora_id in [LORA_WHITE_TO_SCENE, LORA_FUSION]:
            print(f"  - {lora_id}")
            # LoRAs are downloaded when we call load_lora_weights later
    
    @modal.enter()  # Runs when container starts (once per container)
    def load_base_model(self):
        """
        Load the base Qwen model into GPU memory.
        This runs once when the container spins up.
        """
        import torch
        from diffusers import AutoPipelineForImage2Image
        
        print("🚀 Loading Qwen base model into GPU memory...")
        
        # Load the base image-to-image pipeline
        self.pipe = AutoPipelineForImage2Image.from_pretrained(
            QWEN_MODEL_ID,
            torch_dtype=torch.float16,  # Use FP16 for faster inference
            trust_remote_code=True,
            cache_dir="/cache",
        ).to("cuda")
        
        # Enable memory optimizations
        self.pipe.enable_attention_slicing()
        self.pipe.enable_vae_slicing()
        
        # Track currently loaded LoRA
        self.current_lora = None
        
        print("✅ Base model loaded successfully!")
    
    def _decode_image(self, image_base64: str):
        """
        Internal helper to decode base64 image to PIL Image.
        Handles data URI prefix if present.
        """
        from PIL import Image
        image_bytes = base64.b64decode(image_base64.split(",")[-1])
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")
    
    def _decode_mask_optional(self, mask_base64: str | None):
        """
        Internal helper to decode base64 mask to PIL Image.
        Returns None if mask_base64 is None or empty.
        
        This allows mask to be truly optional - important because:
        1. These LoRAs work fine without masks for whole-image edits
        2. Saves bandwidth (no need to send white masks)
        3. Faster inference when mask isn't needed
        """
        if not mask_base64:
            return None
        from PIL import Image
        mask_bytes = base64.b64decode(mask_base64.split(",")[-1])
        return Image.open(io.BytesIO(mask_bytes)).convert("L")
    
    def _switch_lora(self, lora_name: str):
        """
        Internal method to switch between LoRA adapters.
        LoRAs are small adapter weights that modify the base model behavior.
        
        Args:
            lora_name: Either "white_to_scene" or "fusion"
        """
        lora_map = {
            "white_to_scene": LORA_WHITE_TO_SCENE,
            "fusion": LORA_FUSION,
        }
        
        if lora_name not in lora_map:
            raise ValueError(f"Unknown LoRA: {lora_name}. Use 'white_to_scene' or 'fusion'")
        
        lora_id = lora_map[lora_name]
        
        # Skip if this LoRA is already loaded
        if self.current_lora == lora_name:
            print(f"ℹ️  LoRA '{lora_name}' already loaded, skipping...")
            return
        
        print(f"🔄 Switching to LoRA: {lora_name}")
        
        # Unload previous LoRA if any
        if self.current_lora is not None:
            self.pipe.unload_lora_weights()
        
        # Load new LoRA weights from HuggingFace
        self.pipe.load_lora_weights(lora_id)
        self.current_lora = lora_name
        
        print(f"✅ LoRA '{lora_name}' loaded!")
    
    @modal.method()
    def edit_image_white_to_scene(
        self,
        image_base64: str,
        prompt: str,
        mask_base64: str | None = None,
        negative_prompt: str = "blurry, low quality, distorted",
        num_inference_steps: int = 30,
        guidance_scale: float = 7.5,
        strength: float = 0.8,
    ) -> dict:
        """
        Edit image by converting white background to a scene.
        
        This LoRA is specifically trained to detect and replace white backgrounds.
        The mask is OPTIONAL - only use it if you need spatially localized edits.
        
        Args:
            image_base64: Input image as base64 string
            prompt: Description of desired scene (e.g., "modern office background")
            mask_base64: Optional mask (white = edit, black = keep). If None, edits whole image.
            negative_prompt: What to avoid in generation
            num_inference_steps: Number of denoising steps (higher = better quality but slower)
            guidance_scale: How closely to follow prompt (7-8 is good)
            strength: How much to change the image (0-1, higher = more change)
        
        Returns:
            dict with base64 encoded result image
        """
        print(f"🎨 White-to-Scene editing with prompt: '{prompt}'")
        if mask_base64:
            print("   Using spatial mask for localized editing")
        else:
            print("   No mask - editing entire image")
        
        # Switch to white_to_scene LoRA
        self._switch_lora("white_to_scene")
        
        # Decode inputs using helper methods
        image = self._decode_image(image_base64)
        mask = self._decode_mask_optional(mask_base64)
        
        # Build kwargs for pipeline - only include mask if provided
        # This is cleaner than passing mask_image=None and hoping it's tolerated
        kwargs = {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "image": image,
            "num_inference_steps": num_inference_steps,
            "guidance_scale": guidance_scale,
            "strength": strength,
        }
        
        if mask is not None:
            kwargs["mask_image"] = mask
        
        # Run inference
        result = self.pipe(**kwargs).images[0]
        
        # Encode result to base64
        buffer = io.BytesIO()
        result.save(buffer, format="PNG")
        result_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        
        print("✅ White-to-Scene edit complete!")
        
        return {
            "success": True,
            "image_base64": result_base64,
            "lora_used": "white_to_scene",
        }
    
    @modal.method()
    def edit_image_fusion(
        self,
        image_base64: str,
        prompt: str,
        mask_base64: str | None = None,
        negative_prompt: str = "blurry, low quality, distorted",
        num_inference_steps: int = 30,
        guidance_scale: float = 7.5,
        strength: float = 0.8,
    ) -> dict:
        """
        Edit image with fusion/blending technique.
        Good for seamlessly integrating new elements into existing scenes.
        
        This LoRA is trained for blending objects into scenes.
        The mask is OPTIONAL - only use it for spatially localized edits.
        
        Args:
            image_base64: Input image as base64 string
            prompt: Description of what to add/blend (e.g., "red sports car")
            mask_base64: Optional mask (white = edit region). If None, affects whole image.
            negative_prompt: What to avoid
            num_inference_steps: Quality vs speed tradeoff
            guidance_scale: Prompt adherence strength
            strength: Edit intensity
        
        Returns:
            dict with base64 encoded result image
        """
        print(f"🎨 Fusion editing with prompt: '{prompt}'")
        if mask_base64:
            print("   Using spatial mask for localized fusion")
        else:
            print("   No mask - fusion applied to entire image")
        
        # Switch to fusion LoRA
        self._switch_lora("fusion")
        
        # Decode inputs using helper methods
        image = self._decode_image(image_base64)
        mask = self._decode_mask_optional(mask_base64)
        
        # Build kwargs for pipeline - only include mask if provided
        kwargs = {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "image": image,
            "num_inference_steps": num_inference_steps,
            "guidance_scale": guidance_scale,
            "strength": strength,
        }
        
        if mask is not None:
            kwargs["mask_image"] = mask
        
        # Run inference
        result = self.pipe(**kwargs).images[0]
        
        # Encode result
        buffer = io.BytesIO()
        result.save(buffer, format="PNG")
        result_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        
        print("✅ Fusion edit complete!")
        
        return {
            "success": True,
            "image_base64": result_base64,
            "lora_used": "fusion",
        }


# Create web endpoints that can be called via HTTP
@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def white_to_scene_endpoint(data: dict):
    """
    HTTP endpoint for white-to-scene editing.
    
    POST to: https://your-modal-username--qwen-image-edit-server-white-to-scene-endpoint.modal.run
    
    Request body:
    {
        "image_base64": "data:image/png;base64,...",
        "prompt": "modern office with plants",
        "mask_base64": "data:image/png;base64,...",  // OPTIONAL - omit for whole-image edit
        "negative_prompt": "blurry, low quality",  // optional
        "num_inference_steps": 30,  // optional
        "guidance_scale": 7.5,  // optional
        "strength": 0.8  // optional
    }
    
    Note: mask_base64 is now optional! Only include it if you need spatially localized edits.
    The White-to-Scene LoRA is trained to detect white backgrounds automatically.
    """
    editor = QwenImageEditor()
    return editor.edit_image_white_to_scene.remote(
        image_base64=data["image_base64"],
        prompt=data["prompt"],
        mask_base64=data.get("mask_base64"),  # Optional - may be None
        negative_prompt=data.get("negative_prompt", "blurry, low quality, distorted"),
        num_inference_steps=data.get("num_inference_steps", 30),
        guidance_scale=data.get("guidance_scale", 7.5),
        strength=data.get("strength", 0.8),
    )


@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def fusion_endpoint(data: dict):
    """
    HTTP endpoint for fusion editing.
    
    POST to: https://your-modal-username--qwen-image-edit-server-fusion-endpoint.modal.run
    
    Request body:
    {
        "image_base64": "data:image/png;base64,...",
        "prompt": "magical glowing aura",
        "mask_base64": "data:image/png;base64,...",  // OPTIONAL - omit for whole-image edit
        "negative_prompt": "blurry, low quality",  // optional
        "num_inference_steps": 30,  // optional
        "guidance_scale": 7.5,  // optional
        "strength": 0.8  // optional
    }
    
    Note: mask_base64 is now optional! Only include it for spatially localized blending.
    """
    editor = QwenImageEditor()
    return editor.edit_image_fusion.remote(
        image_base64=data["image_base64"],
        prompt=data["prompt"],
        mask_base64=data.get("mask_base64"),  # Optional - may be None
        negative_prompt=data.get("negative_prompt", "blurry, low quality, distorted"),
        num_inference_steps=data.get("num_inference_steps", 30),
        guidance_scale=data.get("guidance_scale", 7.5),
        strength=data.get("strength", 0.8),
    )


# Health check endpoint
@app.function(image=image)
@modal.fastapi_endpoint(method="GET")
def health():
    """Simple health check endpoint"""
    return {"status": "healthy", "service": "qwen-image-edit-server"}
