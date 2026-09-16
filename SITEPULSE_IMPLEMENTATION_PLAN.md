# SitePulse implementation plan

## Phase 1 audit — 2026-09-16

### Current architecture

| Layer | Current implementation | Status |
| --- | --- | --- |
| Browser UI | One static HTML/CSS/JavaScript command-center application in `frontend/` | Working, but mostly a single-project demonstration UI |
| Public hosting | GitHub Pages deploys `frontend/` from `main` through `.github/workflows/deploy-pages.yml` | Working |
| Application API | Node.js `http` server in `server.js` | Working, small route surface |
| Database | PostgreSQL through `pg`, with a four-table legacy schema | Optional; only assessments/events are persisted |
| Email | Server-side EmailJS, Resend, or SMTP adapter | Working when host configuration is present |
| Image comparison | Browser-local four-point homography and edge-density measurement | Supporting visual heuristic only; not construction object detection |
| Digital twin | Three.js presentation model and zone cards | Synthetic demonstration data, not a BIM-derived twin |

### Existing functionality to preserve

- GitHub Pages frontend deployment and Render-compatible Node server.
- Server-only email credentials, origin allow-listing, basic rate limits, CSP/security headers, request-size limits, and path traversal protection.
- Email action-plan flow, including the complete P1/P2/P3 delivery option.
- Four-point manual image alignment, visual aligned-image output, difference map, and explicit manual-review guidance.
- Schedule-baseline selector and assessment workflow.
- PostgreSQL activity loading and existing assessment/event persistence.
- Current construction command-center visual identity and Three.js interaction.

### What is currently simulated, calculated, and persisted

| Area | Current truth state |
| --- | --- |
| Command-center metrics, zone risks, recommendation copy, demo schedule | Hardcoded synthetic demonstration values; several labels currently imply AI/live status too strongly |
| Image comparison | Calculated in the browser from manually selected points and pixel-edge density; it is not OCR, object recognition, quantity measurement, or semantic progress verification |
| Confidence | Heuristic/browser-derived and must not be presented as AI/CV confidence |
| Schedule assessment | Expected progress and variance are calculated from a selected schedule baseline and a manually entered or image-heuristic actual value |
| Assessments | Persisted only when PostgreSQL is configured; report/event IDs are generated in Node |
| Projects, drawings, revisions, DPRs, captures, reviews, audit chain | Not implemented as canonical persisted entities |
| Email | Sent by the configured provider; current template records the request, but provider acceptance is not a proof of recipient inbox delivery |

### Current APIs

- `GET /api/health`
- `GET /api/activities`
- `POST /api/assessments`
- `POST /api/send-email`

### Current database

`database/schema.sql` creates legacy tables: `project_activities`, `site_reports`, `progress_events`, `activity_matches`, and `audit_logs`.

Important migration concern: it currently begins by dropping all of these tables. It is therefore suitable only for an empty development database, not production migration. Future schema changes must use non-destructive, ordered migrations.

## Target architecture

```text
GitHub Pages browser
        |
        v
Node.js application API ---- PostgreSQL / PostGIS ---- object storage
        |
        v
Python FastAPI processing service
  | OCR | OpenCV | schedule/progress engine | optional CV/ML/3D adapters |
```

The Node API remains responsible for project APIs, validation, authorization, signed uploads, audit events, orchestration, and email. The Python service owns deterministic schedule calculations, document/image processing, and optional adapters. Heavy work runs as queued jobs, never as fake progress in a browser request.

## Data and truth model

Every material result must declare one state:

- **OBSERVED** — a capture, OCR result, or CV detection with source evidence.
- **CALCULATED** — deterministic formula and inputs are stored.
- **PREDICTED** — model/trend output with prerequisites and uncertainty.
- **SYNTHETIC DEMO DATA** — clearly labelled sample data only.
- **REVIEW REQUIRED** — insufficient confidence/evidence; no forced match or progress claim.

No ordinary image upload can claim hidden quantities or reliable completion alone. Quantity progress requires BOQ/WBS quantities plus evidence and engineer review.

## Migration strategy

1. Keep existing frontend and API routes operational.
2. Introduce a migration runner and versioned SQL files; retain `schema.sql` only as a bootstrap/reference schema.
3. Add canonical project entities with generated UUIDs, timestamps, and audit metadata.
4. Import legacy activities/events into the first project baseline only through an explicit migration command.
5. Add object storage metadata first; do not commit user files or store large files in PostgreSQL.
6. Gate FastAPI integrations with feature flags and return `SERVICE_UNAVAILABLE`/`REVIEW_REQUIRED` when absent.
7. Replace hardcoded dashboard values only after the canonical APIs return verified or clearly labelled synthetic data.

## API plan

### Phase 2–4 core routes

- `POST /api/projects`, `GET /api/projects/:id`
- `POST /api/projects/:id/drawings`
- `POST /api/projects/:id/schedule`
- `POST /api/projects/:id/dpr`
- `POST /api/projects/:id/site-captures`
- `POST /api/projects/:id/analyze`
- `GET /api/projects/:id/activities`
- `GET /api/projects/:id/progress`
- `GET /api/projects/:id/schedule-variance`
- `GET /api/projects/:id/delays`, `GET /api/projects/:id/risks`
- `POST /api/reviews`, `GET /api/projects/:id/audit-log`

Routes will validate content type, file size, project access, and cross-entity references. Uploading binaries will use signed object-storage URLs rather than JSON request bodies.

## AI/CV service plan

| Capability | Service | Rule |
| --- | --- | --- |
| Drawing/DPR OCR | PaddleOCR adapter | Store text, bounding box, page, source, and confidence; low-confidence records require review |
| Alignment | OpenCV adapter | Preserve manual four-point fallback; reject poor geometry rather than silently accepting it |
| Construction detection | YOLO11/YOLO11-seg adapter | No claim of construction accuracy until a suitable labelled model is evaluated |
| Progress | Python deterministic engine | Uses quantities/counts/weights; stores formula and inputs |
| CPM/dependencies | Python deterministic engine | Supports available dependency data; never LLM arithmetic |
| Risk | Trend rules first, XGBoost only after adequate historical data | Synthetic models are demo-only |
| 3D reconstruction | COLMAP/OpenMVS optional adapter | Explicitly unavailable without sufficient multi-view images |
| Future view | BIM/schedule-derived Three.js, optional Blender render | Never an invented future photo |

## Implementation phases

### Phase 1 — stabilize and document

- Create this plan, document current truth states, add repository checks, and remove misleading claims without breaking existing workflows.
- Convert destructive database bootstrap into versioned migrations.

### Phase 2 — project and evidence foundation

- Add projects, users/roles groundwork, drawings and revisions, object-storage metadata, upload validation, and audit events.

### Phase 3 — schedule/WBS/DPR

- Add schedule import (CSV/XLSX), WBS hierarchy, dependencies, DPR ingestion, and deterministic planned-progress calculation.

### Phase 4 — capture and review workflow

- Add structured site captures, quality checks, manual observations, activity candidate matching, review/override history, and a canonical project-state read API.

### Phase 5 — processing adapters

- Add FastAPI health/job contracts, OpenCV alignment adapter, PaddleOCR adapter, and optional YOLO service. Preserve browser-only visual comparison as an evidence-preview fallback.

### Phase 6 — progress, delays, and digital twin

- Implement quantity/weight formulas, planned-vs-actual, thresholds, downstream effects, evidence links, and a data-driven Three.js twin.

### Phase 7 — simulation, reporting, and hardening

- Add schedule-derived future state, reports, email audit records, authentication/roles, queues, monitoring, backup strategy, and deployment documentation.

### Deferred modular capabilities

- COLMAP/OpenMVS, XGBoost, IFC geometry processing, Blender rendering, and optional image enhancement only after their data and hosting requirements are satisfied.

## Dependencies and deployment

- Node.js 20+, PostgreSQL 16+, and S3-compatible storage are core production dependencies.
- Python FastAPI, OpenCV, Pandas/OpenPyXL, and PaddleOCR form the first processing-service profile.
- YOLO, COLMAP/OpenMVS, Blender, and XGBoost are optional deployment profiles with independent health checks.
- GitHub Pages remains valid for the frontend. Node API, FastAPI workers, PostgreSQL, queues, and storage require backend-capable hosting.

## Risks and limitations

- A GitHub Pages frontend cannot securely process uploads, run Node/Python, or keep secrets.
- Free hosting can sleep, limit storage/CPU, and cannot run a credible always-on CV/reconstruction workload.
- Generic YOLO weights must not be described as construction detection without validation against representative labelled imagery.
- Blueprint/photo pixels do not establish hidden quantities, reinforcement, concrete quality, or full engineering progress.
- Project/authentication/storage design requires real user, retention, and access-policy decisions before production use.

## Phase 1 completion report

- **Files changed:** `SITEPULSE_IMPLEMENTATION_PLAN.md`
- **Dependencies added:** none
- **Database changes:** none; destructive bootstrap identified for replacement in Phase 1 continuation
- **APIs added:** none
- **AI/CV functionality:** no new claim; current browser heuristic documented as supporting evidence only
- **Frontend changes:** none, preserving current working functionality
- **Tests executed:** repository inventory and source/configuration audit
- **Known limitations:** listed above
- **Next phase:** establish non-destructive migrations and canonical project foundation before implementing upload or AI features
