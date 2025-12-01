import numpy as np

LUT_SIZE = 17  # small, fast, enough for good tone


def build_cinematic_warm_lut(size: int = LUT_SIZE) -> np.ndarray:
    """
    Build a small 3D LUT that applies a 'cinematic warm' look.
    This LUT could be learned offline; here we procedurally generate it
    but the runtime application is identical to a learned 3D LUT.
    Returns: array of shape (size, size, size, 3) in [0,1].
    """
    lut = np.zeros((size, size, size, 3), dtype=np.float32)

    for r in range(size):
        for g in range(size):
            for b in range(size):
                rgb = np.array([r, g, b], dtype=np.float32) / (size - 1)

                # start from identity
                warm = rgb.copy()

                # warm shift: boost reds, slightly reduce blues
                warm[0] = np.clip(warm[0] * 1.05 + 0.02, 0.0, 1.0)  # R
                warm[2] = np.clip(warm[2] * 0.97 - 0.01, 0.0, 1.0)  # B

                # tiny extra contrast around midtones
                mid = 0.5
                warm = (warm - mid) * 1.05 + mid
                warm = np.clip(warm, 0.0, 1.0)

                lut[r, g, b] = warm

    return lut


# build once at import time
CINEMATIC_WARM_LUT = build_cinematic_warm_lut(LUT_SIZE)


def apply_3d_lut(img: np.ndarray, lut: np.ndarray) -> np.ndarray:
    """
    Apply a 3D LUT to an image using trilinear interpolation.
    img: (H, W, 3) float32 in [0,1]
    lut: (N, N, N, 3)
    """
    x = np.clip(img, 0.0, 1.0).astype(np.float32)
    size = lut.shape[0]
    scale = (size - 1)

    # scale to LUT coordinates
    r = x[..., 0] * scale
    g = x[..., 1] * scale
    b = x[..., 2] * scale

    r0 = np.floor(r).astype(int)
    g0 = np.floor(g).astype(int)
    b0 = np.floor(b).astype(int)

    r1 = np.clip(r0 + 1, 0, size - 1)
    g1 = np.clip(g0 + 1, 0, size - 1)
    b1 = np.clip(b0 + 1, 0, size - 1)

    dr = r - r0
    dg = g - g0
    db = b - b0

    dr = dr[..., None]
    dg = dg[..., None]
    db = db[..., None]

    # gather 8 corners
    c000 = lut[r0, g0, b0]
    c001 = lut[r0, g0, b1]
    c010 = lut[r0, g1, b0]
    c011 = lut[r0, g1, b1]
    c100 = lut[r1, g0, b0]
    c101 = lut[r1, g0, b1]
    c110 = lut[r1, g1, b0]
    c111 = lut[r1, g1, b1]

    # trilinear interpolation
    c00 = c000 * (1 - db) + c001 * db
    c01 = c010 * (1 - db) + c011 * db
    c10 = c100 * (1 - db) + c101 * db
    c11 = c110 * (1 - db) + c111 * db

    c0 = c00 * (1 - dg) + c01 * dg
    c1 = c10 * (1 - dg) + c11 * dg

    out = c0 * (1 - dr) + c1 * dr
    return np.clip(out, 0.0, 1.0)


def apply_cinematic_lut(img: np.ndarray, strength: float) -> np.ndarray:
    """
    Blend between original and cinematic-warm LUT output.
    strength in [0,1].
    """
    strength = float(strength)
    if strength <= 0.0:
        return img

    lut_img = apply_3d_lut(img, CINEMATIC_WARM_LUT)
    out = img * (1.0 - strength) + lut_img * strength
    return np.clip(out, 0.0, 1.0)
