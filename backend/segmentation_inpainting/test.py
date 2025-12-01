"""
Complete Test Suite for Image Segmentation and Object Extraction
=================================================================

This test demonstrates the full workflow:
1. Upload image
2. Generate mask with SAM
3. Extract object with transparent background
4. Place object on different backgrounds (white, custom image)
5. Prepare for generative fill with SDXL

Run with: python test.py
"""

import requests
import base64
import io
import numpy as np
from PIL import Image
import matplotlib.pyplot as plt
import os
import urllib.request
import sys

PORT = 8000
BASE_URL = f"http://localhost:{PORT}/editing"

print("=" * 70)
print("IMAGE SEGMENTATION & OBJECT EXTRACTION TEST SUITE")
print("=" * 70)

# ============================================================================
# PRE-FLIGHT CHECKS
# ============================================================================
print("\n[PRE-FLIGHT] Checking prerequisites...")

# Check 1: Download cat.jpg if missing
cat_image_path = "./cat.jpg"
if not os.path.exists(cat_image_path):
    print("⚠️  cat.jpg not found. Downloading sample image...")
    try:
        image_url = "https://images.unsplash.com/photo-1614035030394-b6e5b01e0737?q=80&w=686&auto=format&fit=crop"
        urllib.request.urlretrieve(image_url, cat_image_path)
        print(f"✓ Downloaded cat.jpg")
    except Exception as e:
        print(f"❌ Failed to download image: {e}")
        print("Please manually place a test image as 'cat.jpg' in the current directory.")
        exit(1)
else:
    print("✓ cat.jpg found")

# Check 2: Verify server is running
print(f"⚠️  Checking if FastAPI server is running on port {PORT}...")
try:
    health_check = requests.get(f"http://localhost:{PORT}/docs", timeout=2)
    print(f"✓ Server is running")
except requests.exceptions.ConnectionError:
    print(f"\n❌ ERROR: FastAPI server is not running on port {PORT}!")
    print("\nTo start the server, run in another terminal:")
    print("  cd backend")
    print("  python -m uvicorn main:app --reload --port 8000")
    print("\nOr if already in backend directory:")
    print("  uvicorn main:app --reload --port 8000")
    sys.exit(1)
except Exception as e:
    print(f"⚠️  Warning: Could not verify server status: {e}")
    print("Continuing anyway...")

print("\n✓ All prerequisites met. Starting tests...\n")

# ============================================================================
# STEP 1: Upload Image
# ============================================================================
print("=" * 70)
print("[STEP 1] Uploading image...")
print("=" * 70)

cat_img = Image.open(cat_image_path).convert("RGB")
cat_img_np = np.array(cat_img)

buffer = io.BytesIO()
cat_img.save(buffer, format="PNG")
img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

upload_response = requests.post(
    f"{BASE_URL}/upload_image",
    json={"image": img_base64}
)

upload_data = upload_response.json()
print(f"✓ Image uploaded: {upload_data['image_id']}")
print(f"  Size: {upload_data['size']}")

image_id = upload_data["image_id"]

# ============================================================================
# STEP 2: Generate Mask with SAM
# ============================================================================
print("\n" + "=" * 70)
print("[STEP 2] Generating mask with MobileSAM...")
print("=" * 70)

h, w = cat_img_np.shape[:2]
# Click on center of image (should be on the cat)
test_point = [w // 2, h // 2] 

print(f"Click point: {test_point}")

try:
    mask_response = requests.post(
        f"{BASE_URL}/apply_mask",
        json={
            "image_id": image_id,
            "coordinates_list": [test_point]
        }
    )
    mask_response.raise_for_status()
    mask_data = mask_response.json()
    print(f"✓ Mask generated with score: {mask_data['score']:.4f}")
except Exception as e:
    print(f"❌ Error generating mask: {e}")
    sys.exit(1)

# Save mask for visualization
mask_base64 = mask_data["mask_base64"]
mask_bytes = base64.b64decode(mask_base64)
mask_img = Image.open(io.BytesIO(mask_bytes))
mask_img.save("test_mask_output.png")
print("Saved: test_mask_output.png")

# ============================================================================
# STEP 3: Extract Object with Transparent Background
# ============================================================================
print("\n" + "=" * 70)
print("[STEP 3] Extracting object with transparent background...")
print("=" * 70)

try:
    extract_response = requests.post(
        f"{BASE_URL}/extract_object",
        json={
            "image_id": image_id,
            "mask_base64": mask_base64
        }
    )
    extract_response.raise_for_status()
    extract_data = extract_response.json()
    print(f"✓ {extract_data['message']}")
    print(f"Size: {extract_data['size']}")
except Exception as e:
    print(f"❌ Error extracting object: {e}")
    sys.exit(1)

# Save transparent object
object_base64 = extract_data["object_base64"]
object_bytes = base64.b64decode(object_base64)
object_img = Image.open(io.BytesIO(object_bytes))
object_img.save("test_extracted_object.png")
print("Saved: test_extracted_object.png (RGBA with transparency)")

# ============================================================================
# STEP 4A: Place Object on White Canvas
# ============================================================================
print("\n" + "=" * 70)
print("[STEP 4A] Placing object on white canvas...")
print("=" * 70)

try:
    place_white_response = requests.post(
        f"{BASE_URL}/place_object",
        json={
            "object_base64": object_base64,
            "background_color": [255, 255, 255]  # White
        }
    )
    place_white_response.raise_for_status()
    place_white_data = place_white_response.json()
    print(f"✓ {place_white_data['message']}")
    
    # Save composite on white
    composite_white_base64 = place_white_data["composite_base64"]
    composite_white_bytes = base64.b64decode(composite_white_base64)
    composite_white_img = Image.open(io.BytesIO(composite_white_bytes))
    composite_white_img.save("test_object_on_white.png")
    print("Saved: test_object_on_white.png")
    print("→ Ready for Modal Qwen White-to-Scene LoRA! 🎨")
except Exception as e:
    print(f"❌ Error placing on white: {e}")
    sys.exit(1)

# ============================================================================
# STEP 4B: Place Object on Colored Background
# ============================================================================
print("\n" + "=" * 70)
print("[STEP 4B] Placing object on green canvas...")
print("=" * 70)

try:
    place_green_response = requests.post(
        f"{BASE_URL}/place_object",
        json={
            "object_base64": object_base64,
            "background_color": [34, 139, 34]  # Forest green
        }
    )
    place_green_response.raise_for_status()
    place_green_data = place_green_response.json()
    print(f"✓ {place_green_data['message']}")
    
    # Save composite on green
    composite_green_base64 = place_green_data["composite_base64"]
    composite_green_bytes = base64.b64decode(composite_green_base64)
    composite_green_img = Image.open(io.BytesIO(composite_green_bytes))
    composite_green_img.save("test_object_on_green.png")
    print("Saved: test_object_on_green.png")
    print("→ Ready for Modal Qwen Fusion LoRA! 🎨")
except Exception as e:
    print(f"❌ Error placing on green: {e}")
    sys.exit(1)

# ============================================================================
# STEP 4C: Place Object on Custom Background Image
# ============================================================================
print("\n" + "=" * 70)
print("[STEP 4C] Creating custom background and placing object...")
print("=" * 70)

print("Creating gradient background...")
# Create a gradient background as example
bg_width, bg_height = cat_img.size
background = Image.new('RGB', (bg_width, bg_height))
for y in range(bg_height):
    # Gradient from blue to purple
    r = int(100 + (155 * y / bg_height))
    g = int(50 + (50 * y / bg_height))
    b = int(200 - (50 * y / bg_height))
    for x in range(bg_width):
        background.putpixel((x, y), (r, g, b))

# Convert background to base64
bg_buffer = io.BytesIO()
background.save(bg_buffer, format="PNG")
bg_base64 = base64.b64encode(bg_buffer.getvalue()).decode("utf-8")

try:
    place_custom_response = requests.post(
        f"{BASE_URL}/place_object",
        json={
            "object_base64": object_base64,
            "background_image": bg_base64
        }
    )
    place_custom_response.raise_for_status()
    place_custom_data = place_custom_response.json()
    print(f"✓ {place_custom_data['message']}")
    
    # Save composite on custom background
    composite_custom_base64 = place_custom_data["composite_base64"]
    composite_custom_bytes = base64.b64decode(composite_custom_base64)
    composite_custom_img = Image.open(io.BytesIO(composite_custom_bytes))
    composite_custom_img.save("test_object_on_custom_bg.png")
    print("Saved: test_object_on_custom_bg.png")
    print("→ Ready for Modal SDXL Inpainting! 🎨")
except Exception as e:
    print(f"❌ Error placing on custom background: {e}")
    sys.exit(1)

# ============================================================================
# STEP 5: Visualize All Results
# ============================================================================
print("\n" + "=" * 70)
print("[STEP 5] Creating visualization grid...")
print("=" * 70)

try:
    fig, axes = plt.subplots(2, 4, figsize=(16, 8))
    fig.suptitle('Complete Image Segmentation & Object Extraction Workflow', fontsize=16)

    # Row 1: Original workflow
    axes[0, 0].imshow(cat_img)
    axes[0, 0].set_title('1. Original Image')
    axes[0, 0].axis('off')

    axes[0, 1].imshow(mask_img, cmap='gray')
    axes[0, 1].set_title('2. Generated Mask')
    axes[0, 1].axis('off')

    axes[0, 2].imshow(object_img)
    axes[0, 2].set_title('3. Extracted Object\n(with transparency)')
    axes[0, 2].axis('off')

    axes[0, 3].imshow(composite_white_img)
    axes[0, 3].set_title('4A. On White Canvas\n→ Ready for Qwen White-to-Scene')
    axes[0, 3].axis('off')

    # Row 2: Different backgrounds
    axes[1, 0].imshow(composite_green_img)
    axes[1, 0].set_title('4B. On Green Canvas\n→ Ready for Fusion')
    axes[1, 0].axis('off')

    axes[1, 1].imshow(composite_custom_img)
    axes[1, 1].set_title('4C. On Custom Background\n→ Ready for SDXL')
    axes[1, 1].axis('off')

    # Show transparency by checkerboard pattern
    checker = np.zeros((object_img.size[1], object_img.size[0], 3), dtype=np.uint8)
    checker_size = 20
    for i in range(0, object_img.size[1], checker_size):
        for j in range(0, object_img.size[0], checker_size):
            if (i // checker_size + j // checker_size) % 2 == 0:
                checker[i:i+checker_size, j:j+checker_size] = [200, 200, 200]
            else:
                checker[i:i+checker_size, j:j+checker_size] = [100, 100, 100]
    checker_bg = Image.fromarray(checker)
    checker_bg.paste(object_img, (0, 0), object_img)
    axes[1, 2].imshow(checker_bg)
    axes[1, 2].set_title('Transparency Check\n(checkerboard pattern)')
    axes[1, 2].axis('off')

    # Usage instructions
    axes[1, 3].text(0.1, 0.5, 
        'Next Steps:\n\n'
        '1. Use white canvas\n'
        '   → Qwen White-to-Scene\n'
        '   → Generate background\n\n'
        '2. Use green/custom\n'
        '   → Qwen Fusion\n'
        '   → Natural blending\n\n'
        '3. Use any composite\n'
        '   → SDXL Inpainting\n'
        '   → Creative edits',
        fontsize=10,
        verticalalignment='center',
        bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    axes[1, 3].axis('off')

    plt.tight_layout()
    plt.savefig('test_complete_workflow.png', dpi=150, bbox_inches='tight')
    print("✓ Visualization saved: test_complete_workflow.png")
    
except Exception as e:
    print(f"⚠️  Could not create visualization (matplotlib issue): {e}")
    print("   But all image files were saved successfully!")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 70)
print("✅ TEST COMPLETE - ALL STEPS SUCCESSFUL!")
print("=" * 70)

print("\n📁 Generated Files:")
print("  1. test_mask_output.png           - Binary mask from SAM")
print("  2. test_extracted_object.png      - Object with RGBA transparency ✨")
print("  3. test_object_on_white.png       - Ready for Qwen White-to-Scene")
print("  4. test_object_on_green.png       - Ready for Qwen Fusion")
print("  5. test_object_on_custom_bg.png   - Ready for SDXL")
print("  6. test_complete_workflow.png     - Visual summary (if matplotlib worked)")

print("\n🚀 Next Steps - Send to Modal:")
print("  → test_object_on_white.png + Modal Qwen White-to-Scene")
print("    Prompt: 'modern office with plants and natural lighting'")
print()
print("  → Result + Modal Qwen Fusion")
print("    Prompt: 'photorealistic natural blending with shadows'")
print()
print("  → Or test_object_on_green.png directly with Fusion")
print()
print("  → Or any composite with SDXL for creative edits")

print("\n💡 Key Achievement:")
print("  You now have the object with TRANSPARENT background!")
print("  No rectangular selection - just the object with alpha channel.")
print("  Perfect for placing anywhere or AI editing. 🎨")

print("\n" + "=" * 70)

clear_resp = requests.post(f"http://localhost:{PORT}/editing/clear_memory")
print("\nClear Memory Response:", clear_resp.json())

print("\n✓ All tests completed successfully!")
