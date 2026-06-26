from fastapi import APIRouter, File, UploadFile, Form, Depends
from fastapi.responses import JSONResponse
from .auth import get_current_user
import io
import base64
import os
import tempfile
from ..segmentation_inpainting.hf_qwen_space import smart_edit, is_available

router = APIRouter(
    tags=["/inpainting"],
    prefix="/inpainting",
    dependencies=[Depends(get_current_user)]
)

_UNAVAILABLE = {
    "success": False,
    "available": False,
    "error": "AI editing isn't available right now. Add an HF_TOKEN to enable it.",
}


@router.get("/qwen/status")
def qwen_status():
    """Report whether remote AI editing is usable, so the UI can adapt."""
    return {"available": is_available()}


@router.post("/qwen/smart-edit")
async def qwen_smart_edit(file: UploadFile = File(...), prompt: str = Form(...)):
    """
    Run a natural-language image edit on the remote Qwen HF Space.

    The adapter (relight / next-scene / anime / …) is chosen from the prompt.
    Returns the edited image as a base64 data URL, or a 503 with available=False
    when the Space isn't configured/reachable.
    """
    if not is_available():
        return JSONResponse(_UNAVAILABLE, status_code=503)

    tmp_path = None
    try:
        data = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
            tmp.write(data)
            tmp_path = tmp.name

        result_img = smart_edit(tmp_path, prompt)

        buf = io.BytesIO()
        result_img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        return JSONResponse({
            "success": True,
            "available": True,
            "image_base64": f"data:image/png;base64,{b64}",
        })
    except Exception as e:
        print(f"[QWEN ERROR] {type(e).__name__}: {e}")
        return JSONResponse(
            {"success": False, "error": f"AI edit failed: {e}"},
            status_code=500,
        )
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
