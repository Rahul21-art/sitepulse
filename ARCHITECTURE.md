# SitePulse architecture

SitePulse is migrating from a static demonstration dashboard to an evidence-led construction intelligence platform.

```text
GitHub Pages UI -> Node API -> PostgreSQL/PostGIS + object storage
                              -> FastAPI processing jobs
```

## Responsibilities

- **Browser:** data entry, evidence preview, manual alignment/review, dashboards. It never receives mail or storage secrets.
- **Node API:** validation, project lifecycle, authorization boundary, email, audit writes, job orchestration and signed-upload issuance.
- **PostgreSQL:** canonical business state, schedules, observations, reviews and audit records. Large files stay in object storage.
- **FastAPI:** OCR, image quality, OpenCV alignment, deterministic schedule/progress calculations, optional CV and simulation adapters.

The processing service currently provides only a truthful contract. It reports unavailable modules until a real model/service is deployed. See `SITEPULSE_IMPLEMENTATION_PLAN.md` for the staged implementation.

## Evidence statuses

- `observed`: source evidence exists.
- `calculated`: deterministic formula/input chain exists.
- `predicted`: model/trend output with documented prerequisites.
- `synthetic_demo`: sample data only.
- `review_required`: insufficient evidence or confidence.
