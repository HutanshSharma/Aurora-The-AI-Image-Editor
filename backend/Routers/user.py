import os
import base64
import uuid
from fastapi import APIRouter, UploadFile, Depends, HTTPException, File
from ..database import db
from .auth import get_current_user
from typing import Annotated
from pydantic import BaseModel
from PIL import Image
import io

class RenameImageRequest(BaseModel):
    stored_name: str     
    new_name: str         

router = APIRouter(
    tags=['/user'],
    prefix='/user'
)

user_dependency = Annotated[dict, Depends(get_current_user)]

@router.get("/", status_code=200)
async def get_user(current_user: user_dependency, include_image_data: bool = False):
    if current_user is None:
        raise HTTPException(401, "Unauthorized")
    user = await db.users.find_one({"email": current_user["email"]})
    if not user:
        raise HTTPException(404, "User not found")
    user.pop("hashed_password", None)
    user["_id"] = str(user["_id"])
    
    if include_image_data:
        full_images = []
        reversed_images = reversed(user.get("images", []))

        for img in reversed_images:
            stored_name = img["stored_name"]
            img_path = os.path.join("images", stored_name)

            if os.path.exists(img_path):
                with open(img_path, "rb") as f:
                    encoded_img = base64.b64encode(f.read()).decode("utf-8")

                full_images.append({
                    "stored_name": stored_name,
                    "original_name": img["original_name"],
                    "base64": encoded_img
                })
            else:
                full_images.append({
                    "stored_name": stored_name,
                    "original_name": img["original_name"],
                    "base64": None
                })

        user["images"] = full_images
    else:
        image_metadata = []
        reversed_images = reversed(user.get("images", []))
        
        for img in reversed_images:
            image_metadata.append({
                "stored_name": img["stored_name"],
                "original_name": img["original_name"],
                "exists": os.path.exists(os.path.join("images", img["stored_name"]))
            })
        
        user["images"] = image_metadata

    return user

@router.get("/image/{stored_name}", status_code=200)
async def get_image(current_user: user_dependency, stored_name: str):
    if current_user is None:
        raise HTTPException(401, "Unauthorized")
    
    user = await db.users.find_one({"email": current_user["email"]})
    if not user:
        raise HTTPException(404, "User not found")    
    image_record = next((img for img in user.get("images", []) if img["stored_name"] == stored_name), None)
    if not image_record:
        raise HTTPException(404, "Image not found or access denied")
    
    img_path = os.path.join("images", stored_name)
    if not os.path.exists(img_path):
        raise HTTPException(404, "Image file not found on server")
    
    try:
        with open(img_path, "rb") as f:
            encoded_img = base64.b64encode(f.read()).decode("utf-8")
        
        return {
            "stored_name": stored_name,
            "original_name": image_record["original_name"],
            "base64": encoded_img
        }
    except Exception as e:
        raise HTTPException(500, f"Error reading image: {str(e)}")

@router.get("/image/{stored_name}/thumbnail", status_code=200)
async def get_image_thumbnail(current_user: user_dependency, stored_name: str, size: int = 300):
    if current_user is None:
        raise HTTPException(401, "Unauthorized")
    
    user = await db.users.find_one({"email": current_user["email"]})
    if not user:
        raise HTTPException(404, "User not found")
    image_record = next((img for img in user.get("images", []) if img["stored_name"] == stored_name), None)
    if not image_record:
        raise HTTPException(404, "Image not found or access denied")
    
    img_path = os.path.join("images", stored_name)
    if not os.path.exists(img_path):
        raise HTTPException(404, "Image file not found on server")
    
    try:
        with Image.open(img_path) as img:
            img.thumbnail((size, size), Image.Resampling.LANCZOS)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='JPEG', quality=85)
            img_byte_arr = img_byte_arr.getvalue()
            encoded_img = base64.b64encode(img_byte_arr).decode("utf-8")
        
        return {
            "stored_name": stored_name,
            "original_name": image_record["original_name"],
            "base64": encoded_img,
            "is_thumbnail": True,
            "size": size
        }
    except Exception as e:
        raise HTTPException(500, f"Error creating thumbnail: {str(e)}")

@router.post("/upload-image", status_code=201)
async def upload_image(current_user: user_dependency,file: UploadFile = File(...)):
    if current_user is None:
        raise HTTPException(401, "Unauthorized")
    os.makedirs("images", exist_ok=True)
    random_name = f"{uuid.uuid4().hex}{os.path.splitext(file.filename)[1]}"
    save_path = os.path.join("images", random_name)
    with open(save_path, "wb") as f:
        f.write(await file.read())
    await db.users.update_one(
        {"email": current_user["email"]},
        {
            "$push": {
                "images": {
                    "stored_name": random_name,
                    "original_name": file.filename
                }
            }
        }
    )
    return {
        "message": "Image uploaded successfully",
        "stored_name": random_name,
        "original_name": file.filename
    }

@router.delete("/delete-image/{stored_name}", status_code=200)
async def delete_image(current_user: user_dependency, stored_name: str):
    if current_user is None:
        raise HTTPException(401, "Unauthorized")
    user = await db.users.find_one({"email": current_user["email"]})
    if not user:
        raise HTTPException(404, "User not found")
    image_record = next((img for img in user.get("images", []) if img["stored_name"] == stored_name), None)

    if not image_record:
        raise HTTPException(404, f"Image '{stored_name}' not found in user history")
    img_path = os.path.join("images", stored_name)
    if os.path.exists(img_path):
        os.remove(img_path)
    await db.users.update_one(
        {"email": current_user["email"]},
        {"$pull": {"images": {"stored_name": stored_name}}}
    )

    return {"message": f"Image '{stored_name}' deleted successfully"}


@router.put("/rename-image", status_code=200)
async def rename_image(current_user: user_dependency,data: RenameImageRequest):
    if current_user is None:
        raise HTTPException(401, "Unauthorized")

    user = await db.users.find_one({"email": current_user["email"]})
    if not user:
        raise HTTPException(404, "User not found")

    stored_name = data.stored_name
    new_name = data.new_name

    image_record = next((img for img in user.get("images", []) if img["stored_name"] == stored_name), None)
    if not image_record:
        raise HTTPException(404, f"No image found with stored_name = {stored_name}")
    await db.users.update_one(
        {"email": current_user["email"], "images.stored_name": stored_name},
        {"$set": {"images.$.original_name": new_name}}
    )

    return {
        "message": "Image renamed successfully",
        "stored_name": stored_name,
        "new_name": new_name
    }

