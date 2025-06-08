# 2Dto3D - Local Hunyuan3D-2 Image-to-3D Converter

## Overview
This project provides a Flask API backend for converting 2D images to 3D models using Tencent's Hunyuan3D-2 model, running entirely locally.

---

## Setup Instructions

### 1. Download the Hunyuan3D-2 Code
- Clone the [Hunyuan3D-2 repository](https://github.com/TencentARC/Hunyuan3D) from GitHub.
- Copy the `hy3dgen` folder from the repo into the **root** of this project (so it sits next to `main.py`).

### 2. Download the Model Files
- Download the model weights (e.g., `config.yaml`, `model.fp16.ckpt`) for Hunyuan3D-2 from the official repo or HuggingFace.
- Place them in a folder called `models/hunyuan3d-2` in the **root** of this project:

```
models/
└── hunyuan3d-2/
    ├── config.yaml
    └── model.fp16.ckpt
```

### 3. Create and Activate a Virtual Environment
On Windows (PowerShell):
```powershell
python -m venv .venv
.venv\Scripts\Activate.bat
```
On Linux/macOS:
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 4. Install Python Requirements
```sh
pip install -r requirements.txt
```

### 5. Run the Application
```sh
python main.py
```

The Flask API will start, and you can POST images to `/api/convert` to receive a 3D model in OBJ format.

---

## Notes
- Make sure your `PYTHONPATH` includes the project root if you have import issues with `hy3dgen`.
- The `.venv` and `.hy3dgen` folders are ignored by git (see `.gitignore`).
- If the model is not present, the API will return a warning and 503 error for conversion requests.

---

## Example Project Structure
```
2Dto3D/
├── main.py
├── config.json
├── requirements.txt
├── hy3dgen/
├── models/
│   └── hunyuan3d-2/
│       ├── config.yaml
│       └── model.fp16.ckpt
├── src/
│   └── api/
│   └── utils/
│   └── logger/
└── ...
```

---

## Credits
- [TencentARC/Hunyuan3D](https://github.com/sdbds/Hunyuan3D-2-for-windows)
- [Hunyuan3D-2 on HuggingFace](https://huggingface.co/tencent/Hunyuan3D-2)
