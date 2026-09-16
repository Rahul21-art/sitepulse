"""SitePulse local processing service.

Each route reports its evidence state. Computer-vision detections remain review
required because generic model weights have not been validated for a specific
construction project. This service accepts only inline demo/test data; production
uploads must be supplied through authenticated object-storage references.
"""

import base64
import importlib.util
from datetime import datetime, timezone
from typing import Literal

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="SitePulse Processing Service", version="0.1.0")


class AnalyzeRequest(BaseModel):
    project_id: str
    job_type: Literal["ocr", "image_quality", "alignment", "construction_cv", "progress", "future_simulation"]
    input: dict = Field(default_factory=dict)


class ImageRequest(BaseModel):
    image_base64: str = Field(min_length=32, max_length=20_000_000)


class AlignmentRequest(BaseModel):
    blueprint_base64: str = Field(min_length=32, max_length=20_000_000)
    site_base64: str = Field(min_length=32, max_length=20_000_000)
    blueprint_points: list[list[float]] = Field(min_length=4, max_length=4)
    site_points: list[list[float]] = Field(min_length=4, max_length=4)


class RiskRequest(BaseModel):
    planned_progress: float = Field(ge=0, le=100)
    actual_progress: float = Field(ge=0, le=100)
    productivity_trend: float | None = None
    material_delay_days: float = Field(default=0, ge=0)
    predecessor_delay_days: float = Field(default=0, ge=0)


def decode_image(value: str) -> np.ndarray:
    encoded = value.split(",", 1)[-1]
    try:
        binary = base64.b64decode(encoded, validate=True)
    except Exception as error:
        raise HTTPException(400, "image_base64 is invalid.") from error
    if len(binary) > 15_000_000:
        raise HTTPException(413, "Decoded image exceeds the 15 MB local-analysis limit.")
    image = cv2.imdecode(np.frombuffer(binary, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(400, "Image data could not be decoded.")
    return image


def encode_png(image: np.ndarray) -> str:
    ok, buffer = cv2.imencode(".png", image)
    if not ok:
        raise HTTPException(500, "Unable to encode processing output.")
    return "data:image/png;base64," + base64.b64encode(buffer.tobytes()).decode("ascii")


def module_available(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


@app.get("/health")
def health():
    return {"status": "ok", "service": "sitepulse-processing", "time": datetime.now(timezone.utc).isoformat()}


@app.get("/capabilities")
def capabilities():
    return {
        "ocr": {"state": "available" if module_available("paddleocr") else "unavailable", "limitation": "OCR output requires document review."},
        "opencv": {"state": "available", "limitation": "Alignment is geometric evidence, not semantic construction verification."},
        "construction_cv": {"state": "available" if module_available("ultralytics") else "unavailable", "limitation": "Generic weights are not construction-validated; every detection is review required."},
        "ifc": {"state": "available" if module_available("ifcopenshell") else "unavailable", "limitation": "IFC availability does not create BIM/schedule mappings automatically."},
        "reconstruction": {"state": "unavailable", "reason": "COLMAP/OpenMVS workers are not configured."},
        "risk_ml": {"state": "unavailable", "reason": "No validated historical-data model is configured."},
    }


@app.post("/image-quality")
def image_quality(request: ImageRequest):
    image = decode_image(request.image_base64)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape
    blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(gray.mean())
    contrast = float(gray.std())
    accepted = width >= 640 and height >= 480 and blur >= 40 and 30 <= brightness <= 225 and contrast >= 20
    reasons = []
    if min(width, height) < 480: reasons.append("resolution is below 640×480")
    if blur < 40: reasons.append("image is too blurred")
    if brightness < 30: reasons.append("image is too dark")
    if brightness > 225: reasons.append("image is overexposed")
    if contrast < 20: reasons.append("image has insufficient contrast")
    return {"state": "accepted" if accepted else "retake_required", "evidence_status": "observed", "metrics": {"width": width, "height": height, "blur_variance": round(blur, 2), "brightness": round(brightness, 2), "contrast": round(contrast, 2)}, "reason": None if accepted else "Retake required: " + "; ".join(reasons) + "."}


@app.post("/align")
def align(request: AlignmentRequest):
    blueprint, site = decode_image(request.blueprint_base64), decode_image(request.site_base64)
    source = np.float32(request.blueprint_points)
    target = np.float32(request.site_points)
    if source.shape != (4, 2) or target.shape != (4, 2):
        raise HTTPException(400, "Exactly four two-dimensional point pairs are required.")
    matrix = cv2.getPerspectiveTransform(source, target)
    if abs(np.linalg.det(matrix)) < 1e-12:
        raise HTTPException(400, "Control points do not form a usable transform.")
    height, width = blueprint.shape[:2]
    aligned = cv2.warpPerspective(site, np.linalg.inv(matrix), (width, height))
    overlay = cv2.addWeighted(blueprint, 0.5, aligned, 0.5, 0)
    return {"state": "completed", "evidence_status": "observed", "review_required": True, "matrix": matrix.tolist(), "aligned_image": encode_png(aligned), "overlay_image": encode_png(overlay), "message": "Perspective alignment completed. A human must confirm that the matched area is valid before any progress calculation."}


@app.post("/risk/deterministic")
def deterministic_risk(request: RiskRequest):
    variance = request.actual_progress - request.planned_progress
    score = max(0.0, -variance) * 5 + request.material_delay_days * 4 + request.predecessor_delay_days * 5
    if request.productivity_trend is not None and request.productivity_trend < 0:
        score += min(20, abs(request.productivity_trend) * 2)
    level = "at_risk" if score > 50 else "watch" if score > 20 else "on_track"
    return {"state": "completed", "evidence_status": "calculated", "model": "deterministic_trend_rules_v1", "risk_level": level, "risk_score": round(min(score, 100), 2), "inputs": request.model_dump(), "message": "This is a deterministic trend assessment, not a machine-learning prediction."}


@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    return {
        "project_id": request.project_id,
        "job_type": request.job_type,
        "state": "unavailable",
        "evidence_status": "review_required",
        "message": "Processing adapter is not configured. No observation, progress, confidence, or prediction was created.",
    }
