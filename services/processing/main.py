"""SitePulse processing-service contract.

This service deliberately exposes only truthful availability while optional OCR,
OpenCV, YOLO, IFC and reconstruction adapters are not deployed. Node should use
these responses to create review-required jobs, never fabricated results.
"""

from typing import Literal
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="SitePulse Processing Service", version="0.1.0")


class AnalyzeRequest(BaseModel):
    project_id: str
    job_type: Literal["ocr", "image_quality", "alignment", "construction_cv", "progress", "future_simulation"]
    input: dict = Field(default_factory=dict)


@app.get("/health")
def health():
    return {"status": "ok", "service": "sitepulse-processing", "mode": "contract-only"}


@app.get("/capabilities")
def capabilities():
    return {
        "ocr": {"state": "unavailable", "reason": "PaddleOCR adapter is not installed/configured."},
        "opencv": {"state": "unavailable", "reason": "OpenCV adapter is not installed/configured."},
        "construction_cv": {"state": "unavailable", "reason": "Validated construction YOLO weights are not configured."},
        "ifc": {"state": "unavailable", "reason": "IFC parser is not installed/configured."},
        "reconstruction": {"state": "unavailable", "reason": "COLMAP/OpenMVS workers are not configured."},
        "risk_ml": {"state": "unavailable", "reason": "No validated historical-data model is configured."},
    }


@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    return {
        "project_id": request.project_id,
        "job_type": request.job_type,
        "state": "unavailable",
        "evidence_status": "review_required",
        "message": "Processing adapter is not configured. No observation, progress, confidence, or prediction was created.",
    }
