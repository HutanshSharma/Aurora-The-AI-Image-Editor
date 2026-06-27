# Aurora — The AI Image Editor

Aurora is a browser‑based, mobile‑first image editor that pairs a fast,
non‑destructive Canvas pipeline with a stack of AI features — local object
segmentation, three in‑browser colour‑grading neural nets, natural‑language
editing, and voice control — on top of a tree‑based, never‑lose‑your‑work history
system.

- **Frontend:** React 19 + Vite 7 + Tailwind v4
- **Backend:** FastAPI (Python), SQLite via SQLAlchemy
- **AI:** MobileSAM (local) · NeurOp / Deep‑WB / Image‑Adaptive 3D LUT (in‑browser
  ONNX) · Qwen‑Image‑Edit‑2509 (remote) · Whisper Tiny (in‑browser)

---

## Features

### Core editing
- **Adjustments:** brightness, contrast, saturation, blur, sharpen, hue, opacity
- **Transforms:** rotation, horizontal/vertical flip, crop
- **35 cinematic LUTs** (`.CUBE`, trilinear‑interpolated)
- **WYSIWYG export** at full native resolution — no letterbox, no watermark,
  optional transparent background

### AI features
- **Object segmentation** — tap any object (MobileSAM), edit it in isolation,
  lasso‑erase parts, then auto‑blend it back or drop it on a new background
- **AI colour grade** — content‑aware grading from an Image‑Adaptive 3D LUT
- **AI optimize** — predictive tone (NeurOp) + auto white‑balance (Deep‑WB) as a
  new history branch
- **Natural‑language editing** — *"relight as golden hour"*, *"put this on a
  beach"* via remote Qwen‑Image‑Edit‑2509 (gated, degrades gracefully)
- **Voice control** — speak commands; hybrid native Web Speech + in‑browser
  Whisper

### History
- **Tree‑based** (not linear) undo/redo — every branch preserved
- **Time travel** — jump to any state from a thumbnail grid
- **Smart debouncing** so slider drags collapse to a single step

### Accounts & library
- **JWT auth** with email verification and password reset
- **Personal image library** — save finished edits to a per‑user gallery,
  with thumbnails, rename and delete

> **Status note:** all local features (editing, segmentation, colour grading,
> voice, history) work out of the box. The **remote Qwen editing** is gated on an
> `HF_TOKEN` and a live HuggingFace Space; if the Space is down it simply reports
> "unavailable" and the rest of the app is unaffected.

---

## Documentation

Full technical docs live in [`documentation/`](./documentation):

| Topic | Doc |
|-------|-----|
| Canvas rendering pipeline | [01 – Canvas Rendering](./documentation/01-canvas-rendering.md) |
| Basic edits & the LUT engine | [02 – Edits & LUTs](./documentation/02-edits-and-luts.md) |
| Tree‑based history / undo‑redo | [03 – History](./documentation/03-history.md) |
| Segmentation, erase & merge | [04 – Segmentation](./documentation/04-segmentation.md) |
| AI colour grading (3 ONNX models) | [05 – Colour Grading](./documentation/05-color-grading.md) |
| Qwen natural‑language editing | [06 – Qwen AI Editing](./documentation/06-qwen-inpainting.md) |
| Voice input & command parser | [07 – Voice & Commands](./documentation/07-voice-and-commands.md) |
| Accounts & image library | [08 – Accounts & Library](./documentation/08-accounts-and-library.md) |

---

## Tech stack

**Frontend**
- React 19, Vite 7, React Router v7
- Tailwind CSS v4
- Canvas 2D API (rendering, LUTs, compositing)
- `onnxruntime-web` (in‑browser ONNX inference, in a Web Worker)
- `@xenova/transformers` (Whisper, loaded from CDN at runtime)
- framer‑motion / GSAP / Three.js (landing page & UI)

**Backend**
- FastAPI + Uvicorn
- SQLAlchemy (async) over SQLite (`aurora.db`, auto‑created)
- MobileSAM (PyTorch) for segmentation
- `gradio_client` proxy to a HuggingFace Space (Qwen editing)
- Pillow / NumPy / OpenCV for image handling
- JWT auth (`python-jose`, `passlib`), `fastapi-mail` for verify/reset emails

---

## Models used

| Model | Runs | Purpose | Params / config | Repo |
|-------|------|---------|------------------|------|
| **MobileSAM** (`vit_t`) | Backend (local) | Object segmentation | Tiny‑ViT encoder; point‑grid prompts | [ChaoningZhang/MobileSAM](https://github.com/ChaoningZhang/MobileSAM) |
| **NeurOp** | Browser (ONNX) | Predictive tone ("AI optimize") | `neurop_lite.onnx` ~143 KB, `[1,3,256,256]` | [amberwangyili/neurop](https://github.com/amberwangyili/neurop) |
| **Deep White‑Balance** | Browser (ONNX) | Auto white balance | `deepwb_awb.onnx` ~17.5 MB, `[1,3,256,256]` → 33³ LUT | [mahmoudnafifi/Deep_White_Balance](https://github.com/mahmoudnafifi/Deep_White_Balance) |
| **Image‑Adaptive 3D LUT** | Browser (ONNX) | "AI color grade" | classifier 1.08 MB + basis 1.29 MB → fused 33³ LUT | [HuiZeng/Image-Adaptive-3DLUT](https://github.com/HuiZeng/Image-Adaptive-3DLUT) |
| **Qwen‑Image‑Edit‑2509** + LoRAs | Remote HF Space | Natural‑language editing | `steps=4`, `guidance=1.0`; Space `team39/qwen-relight-2509` | [Qwen-Image-Edit-2509](https://huggingface.co/Qwen/Qwen-Image-Edit-2509) |
| **Whisper Tiny (EN)** | Browser (transformers.js) | Voice → text | `Xenova/whisper-tiny.en`, 16 kHz PCM | [Xenova/whisper-tiny.en](https://huggingface.co/Xenova/whisper-tiny.en) |

---

## Setup

### Prerequisites
- **Node.js** 18+ and **npm**
- **Python** 3.10+
- A CUDA GPU is **optional** (MobileSAM runs on CPU if none is present)

### 1. Backend

```bash
python -m venv env
env\Scripts\activate.bat        # Windows  (use: source env/bin/activate on macOS/Linux)
pip install -r requirements.txt
uvicorn backend.main:app        # serves on http://127.0.0.1:8000
```

### 2. Frontend

```bash
npm install
npm run dev                      # serves on http://localhost:3000
```

### 3. Environment

Copy `.env.example` to `.env` and fill in:

| Variable | Purpose | Required |
|----------|---------|----------|
| `SECRET_KEY` | JWT signing for the backend | ✅ |
| `USERMAIL` / `PASSWORD` | SMTP account (email app password) for verify/reset mails | ✅ |
| `FRONTEND_URL` | Base URL used in email links (default `http://localhost:3000`) | ✅ |
| `HF_TOKEN` | HuggingFace token to enable remote **Qwen** editing | optional |
| `HF_SPACE` | Override the target Space (default `team39/qwen-relight-2509`) | optional |
| `DATABASE_URL` | Use a different async SQLAlchemy DB (default = local SQLite) | optional |

The database is a local SQLite file (`aurora.db`), created automatically on first
run — no DB server needed.

---

## Usage

1. **Upload** an image (the editor lives at `/editor`; the landing page is `/`).
2. **Edit** with sliders, LUTs, crop, and transforms — or type/speak a command.
3. **Segment** — tap an object to pull it out; edit, erase, and re‑blend it.
4. **AI** — "AI color grade", "AI optimize" (History), or a natural‑language
   command for Qwen editing.
5. **History** — open the history view to branch, compare, and time‑travel.
6. **Download / Save** — full‑resolution, clean export (optionally transparent).

---

## Repository structure

```
Aurora-The-AI-Image-Editor/
├── backend/                     # FastAPI app
│   ├── main.py                  # app + routers
│   ├── Routers/                 # auth, user, segmentation, inpainting
│   └── segmentation_inpainting/ # MobileSAM + HF Qwen client
├── documentation/               # technical docs (start at README.md)
├── public/
│   ├── luts/                    # 35 .CUBE presets
│   └── models/                  # ONNX weights + LUT basis
├── src/
│   ├── components/
│   │   ├── MainEditor/          # canvas, command input, history, menus
│   │   ├── SegmentEditor/       # segment editing, eraser, backgrounds
│   │   ├── ColorGradingUtils/   # client-side ONNX colour models
│   │   ├── Landing/             # landing page
│   │   └── Auth/                # login / signup
│   ├── hooks/useHistory.jsx     # history tree engine
│   └── utils/                   # historyParser, authFetch, config
├── requirements.txt
├── vite.config.js
└── package.json
```

---

## License

MIT — see [LICENSE](./LICENSE).
