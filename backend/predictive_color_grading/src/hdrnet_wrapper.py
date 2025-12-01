import os
from typing import Optional

import numpy as np

_hdr_model = None
_hdr_device: str = "cpu"


def _init_torch():
    """
    Helper to lazily import torch.
    If import fails (not installed), we return None and fall back to identity.
    """
    try:
        import torch  # type: ignore
        return torch
    except Exception:
        return None


def load_hdrnet_model(weights_path: Optional[str] = None) -> None:
    """
    Initialise a small 'HDRNet-lite' model.

    - If torch is available: build a tiny CNN tone network and optionally
      load weights from HDRNET_WEIGHTS.
    - If torch is NOT available: we keep _hdr_model = None and use identity,
      so the rest of the pipeline still works.
    """
    global _hdr_model, _hdr_device

    torch = _init_torch()
    if torch is None:
        print("[HDRNET] torch not available, using identity tone (no-op).")
        _hdr_model = None
        _hdr_device = "cpu"
        return

    class HDRNetLite(torch.nn.Module):
        """
        Very small CNN to approximate tone mapping.
        This stands in for full HDRNet, but is fast and simple.
        """

        def __init__(self, channels: int = 16):
            super().__init__()
            self.conv1 = torch.nn.Conv2d(3, channels, kernel_size=3, padding=1)
            self.conv2 = torch.nn.Conv2d(channels, channels, kernel_size=3, padding=1)
            self.conv3 = torch.nn.Conv2d(channels, 3, kernel_size=3, padding=1)

        def forward(self, x):
            h = torch.relu(self.conv1(x))
            h = torch.relu(self.conv2(h))
            residual = torch.tanh(self.conv3(h)) * 0.1  # limit magnitude
            out = torch.clamp(x + residual, 0.0, 1.0)
            return out

    _hdr_device = "cuda" if torch.cuda.is_available() else "cpu"
    model = HDRNetLite().to(_hdr_device)

    if weights_path is not None and os.path.exists(weights_path):
        try:
            state = torch.load(weights_path, map_location=_hdr_device)
            model.load_state_dict(state)
            print(f"[HDRNET] Loaded HDRNet-lite weights from {weights_path}")
        except Exception as e:
            print(f"[HDRNET] Failed to load weights: {e}. Using random weights.")

    model.eval()
    _hdr_model = model
    print(f"[HDRNET] HDRNet-lite initialised on {_hdr_device}.")


def apply_hdrnet(img: np.ndarray) -> np.ndarray:
    """
    Apply HDRNet-lite tone mapping to an image.

    img: (H, W, 3) float32 in [0,1].

    - If _hdr_model is None: identity (returns img).
    - If model exists: runs the tiny CNN and returns toned output.
    """
    global _hdr_model, _hdr_device

    if _hdr_model is None:
        # Identity fallback so pipeline always runs
        return np.clip(img, 0.0, 1.0)

    torch = _init_torch()
    if torch is None:
        return np.clip(img, 0.0, 1.0)

    x = np.clip(img, 0.0, 1.0).astype(np.float32)
    x_t = torch.from_numpy(x).permute(2, 0, 1).unsqueeze(0).to(_hdr_device)

    with torch.no_grad():
        y_t = _hdr_model(x_t)

    y = y_t.squeeze(0).permute(1, 2, 0).cpu().numpy()
    return np.clip(y, 0.0, 1.0)
