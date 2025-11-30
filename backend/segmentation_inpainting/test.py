import requests
import base64
import io
import numpy as np
from PIL import Image
import matplotlib.pyplot as plt
import cv2

PORT = 8000 
cat_img = Image.open("./cat.jpg").convert("RGB")
cat_img_np = np.array(cat_img)

buffer = io.BytesIO()
cat_img.save(buffer, format="PNG")
img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

print("Uploading image...")

upload_response = requests.post(
    f"http://localhost:{PORT}/editing/upload_image",
    json={"image": img_base64}
)

upload_data = upload_response.json()
print("Upload Response:", upload_data)

image_id = upload_data["image_id"]

h, w = cat_img_np.shape[:2]
test_point = [w // 2, h // 2] 

print("\nSending point:", test_point)

mask_response = requests.post(
    f"http://localhost:{PORT}/editing/apply_mask",
    json={
        "image_id": image_id,
        "coordinates_list": [test_point]
    }
)

mask_data = mask_response.json()
print("\nMask Response:", mask_data)

if "mask_base64" in mask_data:
    mask_bytes = base64.b64decode(mask_data["mask_base64"])
    mask_img = Image.open(io.BytesIO(mask_bytes))
    mask_img.save("mask_output.png")
    print("✓ Mask saved to mask_output.png")

mask_gray = cv2.imread("mask_output.png", cv2.IMREAD_GRAYSCALE)

fig, axes = plt.subplots(1, 3, figsize=(15, 5))

axes[0].imshow(cat_img_np)
axes[0].set_title("Original")
axes[0].axis("off")

axes[1].imshow(mask_gray, cmap="gray")
axes[1].set_title("Mask")
axes[1].axis("off")

overlay = cat_img_np.copy()
mask_color = np.zeros_like(cat_img_np)
mask_color[:, :, 1] = mask_gray 
overlay_img = cv2.addWeighted(overlay, 0.7, mask_color, 0.3, 0)

axes[2].imshow(overlay_img)
axes[2].set_title("Overlay")
axes[2].axis("off")

plt.tight_layout()
plt.show()

clear_resp = requests.post(f"http://localhost:{PORT}/editing/clear_memory")
print("\nClear Memory Response:", clear_resp.json())

print("\n✓ All tests completed successfully!")
