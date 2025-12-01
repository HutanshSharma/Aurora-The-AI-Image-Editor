"""
Modal Server for SDXL Mask-Based Image Editing
===============================================
This script deploys Stable Diffusion XL for mask-based inpainting.
You can add custom LoRAs for different editing styles.

SDXL is great for:
- High-quality inpainting (filling masked regions)
- Creative edits with text prompts
- Style transfer with LoRAs

Modal automatically handles:
- Model downloading and caching (SDXL is ~7GB)
- GPU provisioning (A10G or A100)
- HTTP endpoint creation
- Auto-scaling

Setup Instructions:
1. Install Modal: pip install modal
2. Set up Modal token: modal token new
3. Deploy this app: modal deploy modal_sdxl_server.py
4. Modal will give you a public URL endpoint

You can add custom SDXL LoRAs by modifying the CUSTOM_LORAS list below.
"""

import modal
import io
import base64
from pathlib import Path

# Create Modal app
app = modal.App("sdxl-inpainting-server")

# Define Docker image with dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "numpy<2.0.0",  # Pin to 1.x for compatibility
        "torch==2.5.1",
        "torchvision==0.20.1",
        "diffusers>=0.25.0",
        "transformers>=4.37.0",
        "accelerate>=0.25.0",
        "peft>=0.8.0",  # For LoRA support
        "pillow>=10.0.0",
        "safetensors>=0.4.0",
        "compel>=2.0.0",  # For advanced prompt weighting
        "fastapi",  # Required for web endpoints
    )
)

# Base SDXL model
SDXL_MODEL_ID = "stabilityai/stable-diffusion-xl-base-1.0"

# Optional: Add your custom SDXL LoRAs here
# Format: (name, huggingface_model_id, weight)
CUSTOM_LORAS = [
    # Example: ("realistic", "username/realistic-lora", 0.8),
    # Add your LoRAs here in this format:
    # ("lora_name", "huggingface_model_id", 0.8),
]


@app.cls(
    image=image,
    gpu="A10G",  # Use A10G GPU (24GB VRAM) - change to "A100" for production
    timeout=600,
    scaledown_window=120,  # Keep warm for 2 minutes (cost optimization)
)
@modal.concurrent(max_inputs=1)  # Avoid race conditions with diffusers pipeline
class SDXLInpainter:
    """
    Modal class for SDXL-based inpainting with optional LoRA support.
    
    Inpainting = filling in masked regions with AI-generated content.
    The mask tells the model which parts to regenerate.
    """
    
    @modal.enter()
    def download_models(self):
        """
        Pre-download SDXL model during image build.
        This is a one-time download (~7GB) that gets cached.
        """
        from diffusers import AutoPipelineForInpainting
        
        print("📥 Downloading SDXL base model (~7GB, one-time download)...")
        AutoPipelineForInpainting.from_pretrained(
            SDXL_MODEL_ID,
            cache_dir="/cache",
            variant="fp16",  # Use half-precision to save memory
        )
        print("✅ SDXL model cached!")
        
        # Pre-download custom LoRAs if specified
        if CUSTOM_LORAS:
            print(f"📥 Pre-downloading {len(CUSTOM_LORAS)} custom LoRAs...")
            for name, lora_id, weight in CUSTOM_LORAS:
                print(f"  - {name} ({lora_id})")
    
    @modal.enter()
    def load_model(self):
        """
        Load SDXL inpainting pipeline into GPU memory.
        Runs once per container startup.
        """
        import torch
        from diffusers import AutoPipelineForInpainting
        
        print("🚀 Loading SDXL inpainting pipeline...")
        
        # Load the inpainting-specific pipeline
        self.pipe = AutoPipelineForInpainting.from_pretrained(
            SDXL_MODEL_ID,
            torch_dtype=torch.float16,
            variant="fp16",
            cache_dir="/cache",
        ).to("cuda")
        
        # Enable memory optimizations
        # These techniques reduce VRAM usage without hurting quality
        self.pipe.enable_attention_slicing()
        self.pipe.enable_vae_slicing()
        
        # Optional: Enable xformers for faster inference (if available)
        try:
            self.pipe.enable_xformers_memory_efficient_attention()
            print("✅ xformers enabled for faster inference")
        except Exception as e:
            print(f"⚠️  xformers not available: {e}")
        
        # Load custom LoRAs if specified
        self.loaded_loras = {}
        if CUSTOM_LORAS:
            print(f"🔧 Loading {len(CUSTOM_LORAS)} custom LoRAs...")
            for name, lora_id, weight in CUSTOM_LORAS:
                try:
                    self.pipe.load_lora_weights(lora_id, adapter_name=name)
                    self.loaded_loras[name] = (lora_id, weight)
                    print(f"  ✅ Loaded: {name}")
                except Exception as e:
                    print(f"  ⚠️  Failed to load {name}: {e}")
        
        print("✅ SDXL pipeline ready!")
    
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
        
        For SDXL inpainting, mask is typically required, but we allow
        optional masks for flexibility (e.g., img2img without inpainting).
        """
        if not mask_base64:
            return None
        from PIL import Image
        mask_bytes = base64.b64decode(mask_base64.split(",")[-1])
        return Image.open(io.BytesIO(mask_bytes)).convert("L")
    
    @modal.method()
    def inpaint(
        self,
        image_base64: str,
        prompt: str,
        mask_base64: str | None = None,
        negative_prompt: str = "blurry, low quality, distorted, ugly, bad anatomy",
        num_inference_steps: int = 40,
        guidance_scale: float = 7.5,
        strength: float = 0.99,
        lora_name: str = None,
    ) -> dict:
        """
        Perform mask-based inpainting with SDXL.
        
        How it works:
        1. Input image + mask define what to keep vs. regenerate
        2. SDXL generates new content for masked regions
        3. Unmasked areas remain unchanged
        4. The result is seamlessly blended
        
        For SDXL inpainting, mask is typically needed. If omitted, this acts
        like img2img (transforms the whole image based on prompt).
        
        Args:
            image_base64: Original image as base64 string
            prompt: What to generate in masked area (e.g., "red sports car")
            mask_base64: Optional binary mask (white = inpaint, black = keep original)
            negative_prompt: What to avoid generating
            num_inference_steps: Quality vs speed (30-50 is good, higher = better quality)
            guidance_scale: How closely to follow prompt (7-8 recommended)
            strength: How much to change (0.99 = maximum change for inpainting)
            lora_name: Optional - name of custom LoRA to apply (from CUSTOM_LORAS)
        
        Returns:
            dict with base64 encoded inpainted image
        """
        import numpy as np
        
        print(f"🎨 Inpainting with prompt: '{prompt}'")
        if mask_base64:
            print("   Using mask for localized inpainting")
        else:
            print("   No mask - will transform entire image (img2img mode)")
        if lora_name:
            print(f"   Using LoRA: {lora_name}")
        
        # Decode inputs using helper methods
        image = self._decode_image(image_base64)
        mask = self._decode_mask_optional(mask_base64)
        
        # SDXL works best with images sized to multiples of 8
        # Resize if needed
        from PIL import Image
        width, height = image.size
        new_width = (width // 8) * 8
        new_height = (height // 8) * 8
        
        if (new_width, new_height) != (width, height):
            print(f"📏 Resizing from {width}x{height} to {new_width}x{new_height}")
            image = image.resize((new_width, new_height), Image.LANCZOS)
            if mask is not None:
                mask = mask.resize((new_width, new_height), Image.LANCZOS)
        
        # Activate LoRA if specified
        if lora_name and lora_name in self.loaded_loras:
            lora_id, lora_weight = self.loaded_loras[lora_name]
            self.pipe.set_adapters([lora_name], adapter_weights=[lora_weight])
            print(f"🔧 Activated LoRA: {lora_name} (weight: {lora_weight})")
        
        # Build kwargs for pipeline - only include mask if provided
        # This allows both inpainting (with mask) and img2img (without mask) modes
        kwargs = {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "image": image,
            "num_inference_steps": num_inference_steps,
            "guidance_scale": guidance_scale,
            "strength": strength,
            "height": new_height,
            "width": new_width,
        }
        
        if mask is not None:
            kwargs["mask_image"] = mask
        
        # Run SDXL inpainting
        result = self.pipe(**kwargs).images[0]
        
        # Resize back to original dimensions if needed
        if (new_width, new_height) != (width, height):
            result = result.resize((width, height), Image.LANCZOS)
        
        # Encode result to base64
        buffer = io.BytesIO()
        result.save(buffer, format="PNG")
        result_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        
        print("✅ Inpainting complete!")
        
        return {
            "success": True,
            "image_base64": result_base64,
            "model": "sdxl",
            "lora_used": lora_name,
        }
    
    @modal.method()
    def list_loras(self) -> dict:
        """
        List all available LoRAs loaded in this instance.
        
        Returns:
            dict with list of available LoRA names
        """
        return {
            "available_loras": list(self.loaded_loras.keys()),
            "details": [
                {
                    "name": name,
                    "model_id": lora_id,
                    "weight": weight
                }
                for name, (lora_id, weight) in self.loaded_loras.items()
            ]
        }


# HTTP Web Endpoints
@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def inpaint_endpoint(data: dict):
    """
    HTTP endpoint for SDXL inpainting.
    
    POST to: https://your-modal-username--sdxl-inpainting-server-inpaint-endpoint.modal.run
    
    Request body:
    {
        "image_base64": "data:image/png;base64,...",
        "prompt": "modern kitchen with marble countertops",
        "mask_base64": "data:image/png;base64,...",  // OPTIONAL - omit for img2img mode
        "negative_prompt": "bow quality",  // optional
        "num_inference_steps": 40,lurry, l  // optional, 30-50 recommended
        "guidance_scale": 7.5,  // optional
        "strength": 0.99,  // optional, usually keep at 0.99 for inpainting
        "lora_name": "realistic"  // optional, if you have custom LoRAs
    }
    
    Response:
    {
        "success": true,
        "image_base64": "base64_encoded_result",
        "model": "sdxl",
        "lora_used": "realistic" or null
    }
    
    Note: mask_base64 is now optional! If omitted, runs in img2img mode (transforms whole image).
    """
    inpainter = SDXLInpainter()
    return inpainter.inpaint.remote(
        image_base64=data["image_base64"],
        prompt=data["prompt"],
        mask_base64=data.get("mask_base64"),  # Optional - may be None
        negative_prompt=data.get("negative_prompt", "blurry, low quality, distorted, ugly"),
        num_inference_steps=data.get("num_inference_steps", 40),
        guidance_scale=data.get("guidance_scale", 7.5),
        strength=data.get("strength", 0.99),
        lora_name=data.get("lora_name", None),
    )


@app.function(image=image)
@modal.fastapi_endpoint(method="GET")
def list_loras_endpoint():
    """
    List available LoRAs.
    
    GET: https://your-modal-username--sdxl-inpainting-server-list-loras-endpoint.modal.run
    """
    inpainter = SDXLInpainter()
    return inpainter.list_loras.remote()


@app.function(image=image)
@modal.fastapi_endpoint(method="GET")
def health():
    """Health check endpoint"""
    return {"status": "healthy", "service": "sdxl-inpainting-server"}
