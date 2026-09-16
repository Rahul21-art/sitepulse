# SitePulse processing service

This FastAPI service contains real local OpenCV operations and deterministic risk rules. It also declares adapters for PaddleOCR, Ultralytics YOLO, and IFC parsing.

## Local setup

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r services\processing\requirements.txt
.\services\processing\run-local.ps1
```

Open `http://127.0.0.1:8000/docs` after it starts.

## Implemented now

- `POST /image-quality`: resolution, blur, brightness and contrast checks.
- `POST /align`: OpenCV four-point perspective alignment and overlay.
- `POST /risk/deterministic`: deterministic, explainable trend rules.
- `GET /capabilities`: accurate optional-module state.

## Important limitations

- The service currently uses inline base64 images only for local testing. Production requires private object storage, signed references, authentication, MIME/size validation and asynchronous workers.
- Installing YOLO does not prove a generic model recognizes construction activities. Detection output remains review-required until a construction-labelled model is evaluated.
- PaddleOCR and IFC support are dependencies/adapters, not a claim that every drawing/DPR/IFC is automatically interpreted correctly.
- COLMAP/OpenMVS needs separate GPU/worker deployment and enough calibrated multi-view evidence.
