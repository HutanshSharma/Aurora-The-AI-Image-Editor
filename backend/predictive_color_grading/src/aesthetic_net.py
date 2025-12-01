import os
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F


class AestheticNet(nn.Module):
    """
    Tiny NIMA-like aesthetic scorer.
    Input:  (B, 3, H, W) in [0,1]
    Output: (B,) scalar score (higher = nicer)
    Architecture: small CNN + global pooling + MLP.
    """

    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(3, 16, kernel_size=3, padding=1)
        self.conv2 = nn.Conv2d(16, 32, kernel_size=3, padding=1)
        self.conv3 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.fc1   = nn.Linear(64, 32)
        self.fc2   = nn.Linear(32, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        h = F.relu(self.conv1(x))
        h = F.max_pool2d(h, 2)  # /2

        h = F.relu(self.conv2(h))
        h = F.max_pool2d(h, 2)  # /4

        h = F.relu(self.conv3(h))
        # global average pool
        h = h.mean(dim=(2, 3))  # (B, 64)

        h = F.relu(self.fc1(h))
        score = self.fc2(h).squeeze(1)  # (B,)
        return score


_aesthetic_model: Optional[AestheticNet] = None
_aesthetic_device: str = "cpu"


def load_aesthetic_model(weights_path: Optional[str] = None) -> None:
    """
    Initialise global aesthetic model.
    If weights_path is None or file missing, we keep random weights.
    You can later plug real trained weights here.
    """
    global _aesthetic_model, _aesthetic_device

    _aesthetic_device = "cuda" if torch.cuda.is_available() else "cpu"
    model = AestheticNet()
    model.to(_aesthetic_device)

    if weights_path is not None and os.path.exists(weights_path):
        state = torch.load(weights_path, map_location=_aesthetic_device)
        model.load_state_dict(state)

    model.eval()
    _aesthetic_model = model


def score_aesthetic(img: np.ndarray) -> float:
    """
    img: (H, W, 3) float32 [0,1]
    Returns a scalar aesthetic score (float).
    If model is uninitialised, returns 0.0.
    """
    global _aesthetic_model, _aesthetic_device

    if _aesthetic_model is None:
        return 0.0

    x = np.clip(img, 0.0, 1.0).astype(np.float32)
    x_t = torch.from_numpy(x).permute(2, 0, 1).unsqueeze(0).to(_aesthetic_device)

    with torch.no_grad():
        s = _aesthetic_model(x_t)  # (1,)
    return float(s.item())
