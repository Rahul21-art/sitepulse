# Deployment

## Frontend

GitHub Pages publishes `frontend/`. Configure `API_BASE_URL` in the frontend for the deployed Node API and set the backend `CORS_ORIGIN` exactly to `https://rahul21-art.github.io`.

## Node API

Deploy Node 20+ with a managed PostgreSQL database. Set `DATABASE_URL`, email-provider variables, `CORS_ORIGIN`, and `HOST=0.0.0.0`. The Render Blueprint runs `npm run migrate` as part of its build, so the additive migrations are applied before the API starts. For any other host, run it explicitly before enabling project routes.

## Processing service

Deploy `services/processing` separately only after the required adapters and authentication are configured:

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

The starter service is contract-only. It must not be advertised as PaddleOCR, YOLO, IFC, or reconstruction processing until those modules and their tests are deployed.

## Storage and queues

Use S3-compatible private object storage plus signed URLs for user files. Add a queue/worker before enabling long-running OCR, CV, reconstruction, or rendering jobs. Do not upload files through GitHub Pages directly to the API without MIME, size, checksum, and authorization validation.
