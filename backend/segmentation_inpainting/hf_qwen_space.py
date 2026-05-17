import os
import shutil
from PIL import Image
from dotenv import load_dotenv

load_dotenv()
HF_TOKEN = os.getenv("HF_TOKEN")

# NOTE: Hugging Face space is no longer active. Connection disabled.
# This module is deprecated and should not be used.
print("WARNING: HF Qwen space is no longer active. This module is deprecated.")

# try:
#     from gradio_client import Client, handle_file
#     client = Client(
#         "team39/qwen-relight-2509", 
#         token=HF_TOKEN
#     )
#     print("Successfully connected to the Private Space.")
# except Exception as e:
#     print(f"Connection failed: {e}")
#     exit()

client = None

AVAILABLE_ADAPTERS = [
    'Photo-to-Anime', 'Multiple-Angles', 'Light-Restoration', 
    'Multi-Angle-Lighting', 'Upscale-Image', 'Relight', 
    'Next-Scene', 'Edit-Skin'
]

def get_best_adapter(prompt: str, default_adapter: str = "Relight"):
    """Determine the best lora adapter based on the prompt"""
    prompt_lower = prompt.lower()
    
    if any(keyword in prompt_lower for keyword in ['background', 'scene', 'environment', 'setting', 'place']):
        return 'Next-Scene'
    
    if any(keyword in prompt_lower for keyword in ['light', 'lighting', 'illuminate', 'shadow', 'bright', 'dark', 'golden hour', 'sunset']):
        return 'Relight'
    
    if any(keyword in prompt_lower for keyword in ['skin', 'face', 'portrait', 'complexion']):
        return 'Edit-Skin'
    
    if any(keyword in prompt_lower for keyword in ['anime', 'cartoon', 'animated']):
        return 'Photo-to-Anime'
    
    if any(keyword in prompt_lower for keyword in ['enhance', 'improve', 'upscale', 'quality']):
        return 'Upscale-Image'
    
    if any(keyword in prompt_lower for keyword in ['restore', 'fix', 'repair']):
        return 'Light-Restoration'
    
    return default_adapter

def white_to_scene(image_path: str, prompt: str):
    adapter = get_best_adapter(prompt, "Next-Scene")
    
    try:
        result = client.predict(
            input_image=handle_file(image_path),
            prompt=prompt,
            lora_adapter=adapter, 
            seed=0, 
            randomize_seed=True, 
            guidance_scale=1.0, 
            steps=4, 
            api_name="/infer"
        )
    except Exception as e:
        print(f"Failed with adapter {adapter}, trying Relight: {e}")
        result = client.predict(
            input_image=handle_file(image_path),
            prompt=prompt,
            lora_adapter="Relight", 
            seed=0, 
            randomize_seed=True, 
            guidance_scale=1.0, 
            steps=4, 
            api_name="/infer"
        )    
    temp_path = result[0]    
    output_path = "output_white_to_scene.png"
    shutil.move(temp_path, output_path)
    print(f"Output saved to {output_path}")
    return Image.open(output_path)

def fusion(image_path: str, prompt: str):
    adapter = get_best_adapter(prompt, "Relight")
    
    try:
        result = client.predict(
            input_image=handle_file(image_path),
            prompt=prompt,
            lora_adapter=adapter, 
            seed=0, 
            randomize_seed=True, 
            guidance_scale=1.0, 
            steps=4, 
            api_name="/infer"
        )
    except Exception as e:
        print(f"Fusion failed with {adapter}, trying Multi-Angle-Lighting: {e}")
        result = client.predict(
            input_image=handle_file(image_path),
            prompt=prompt,
            lora_adapter="Multi-Angle-Lighting", 
            seed=0, 
            randomize_seed=True, 
            guidance_scale=1.0, 
            steps=4, 
            api_name="/infer"
        )
    
    temp_path = result[0]
    output_path = "output_fusion.png"
    shutil.move(temp_path, output_path)
    print(f"Output saved to {output_path}")
    return Image.open(output_path)

def relight(image_path: str, prompt: str):
    result = client.predict(
        input_image=handle_file(image_path),
        prompt=prompt,
        lora_adapter="Relight", 
        seed=0, 
        randomize_seed=True, 
        guidance_scale=1.0, 
        steps=4, 
        api_name="/infer"
    )
    
    temp_path = result[0]
    output_path = "output_relight.png"
    shutil.move(temp_path, output_path)
    print(f"Output saved to {output_path}")
    return Image.open(output_path)