# SitePulse — Infrastructure Intelligence Platform

SitePulse is a SIH26122 construction-monitoring prototype combining a 3D digital twin, schedule intelligence, site-photo assessment and project reporting.

## What changed

The repository has been hardened and reorganized:

- `frontend/` contains the browser application and static assets.
- `backend/` contains the Node API and PostgreSQL/email services.
- `database/schema.sql` contains the PostgreSQL schema.
- The original PostgreSQL dump is retained under `database/backups/` for reference.
- SMTP passwords are server-only and are never accepted from browser requests.
- CORS is opt-in and no longer allows `*`.
- Security headers, request-size limits, basic rate limiting, input validation and path-traversal protection are enabled.
- PostgreSQL activity loading and assessment persistence are exposed through `/api/activities` and `/api/assessments`.
- Real email delivery is handled only by the backend through `/api/send-email`.
- Sensitive email dispatch logs were removed from the repository.

## Run locally

Requirements: Node.js 18+.

```bash
npm install
copy .env.example .env
npm start
```

Open:

`http://localhost:8080`

The frontend can still be previewed without PostgreSQL or SMTP. In that mode, the dashboard uses its built-in schedule baseline and clearly reports that persistence/email are not configured.

## PostgreSQL

Create a database named `sitepulse`, then apply:

```bash
psql -U postgres -d sitepulse -f database/schema.sql
```

Set `PGUSER`, `PGPASSWORD`, `PGDATABASE`, and related variables in `.env`, then restart the server.

When PostgreSQL is configured, the app loads planned activities from `project_activities` and persists assessment reports/events.

### Canonical project foundation

New production-oriented tables are managed with additive migrations. Do not run
`database/schema.sql` against a populated production database because that file
contains legacy drop-and-create statements. Instead run:

```bash
npm run migrate
```

The first migration introduces projects, revisions, file metadata, processing
jobs, canonical project state and an append-only audit-event foundation. It does
not upload files or claim OCR/CV/BIM processing is available. Query
`GET /api/processing-capabilities` to see the truthful service availability.

## Email

For Gmail, use an App Password rather than your normal account password. Put SMTP settings only in `.env`:

```text
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-account@gmail.com
SMTP_PASS=your-16-character-app-password
SMTP_FROM=your-account@gmail.com
```

### Resend (recommended for Render Free)

Render Free blocks outbound SMTP ports, so configure these environment variables
instead of SMTP for the deployed backend. Resend sends through its HTTPS API.

```env
RESEND_API_KEY=re_your_api_key
RESEND_FROM=SitePulse <notifications@your-verified-domain.com>
```

Verify the sender domain in Resend before deploying. The backend automatically
prefers Resend whenever `RESEND_API_KEY` is set.

### EmailJS with Gmail (free, low-volume)

To send to arbitrary recipients without a custom domain, connect Gmail in
EmailJS, create a template whose To Email field is `{{manager_email}}`, and
set the following backend variables. The backend passes the complete HTML
action plan to the template's `{{{html}}}` content placeholder.

```env
EMAILJS_SERVICE_ID=service_xxxxxxx
EMAILJS_TEMPLATE_ID=template_xxxxxxx
EMAILJS_PUBLIC_KEY=your_emailjs_public_key
EMAILJS_PRIVATE_KEY=your_emailjs_private_key
EMAILJS_REPLY_TO=your-gmail-address@gmail.com
```

EmailJS is preferred whenever all three EmailJS identifiers are configured.

The browser sends only the recipient and message data. SMTP credentials never leave the backend.

## Blueprint vs. site image comparison

The Photo-Based Site Assessment section includes a browser-local, real image comparison workflow with no external CV dependency:

1. Upload a blueprint and a current site image.
2. Click four matching landmarks in both images to calculate a perspective homography.
3. Trace the planned work zone on the blueprint.
4. Run the comparison to warp the site image into blueprint space and calculate edge-structure coverage inside that zone.

The computed coverage percentage fills the assessment's actual-progress field and is included with the schedule variance in the report. The UI explicitly labels this as a **REAL CV RESULT** only after those steps succeed; otherwise it remains unavailable and the report identifies the progress as manual/fallback.

This MVP uses image structure/edge coverage, not an object-recognition construction model. A site engineer must review the aligned image and difference map before accepting the value as verified progress.

For a reliable first test, use the matched pair in `frontend/assets/comparison-blueprint.svg` and `frontend/assets/comparison-site.svg`. Click the four cyan outer-corner markers in the same order on each image, then trace either interior planned area.

## Production deployment

GitHub Pages can host only the static frontend; it cannot execute this Node backend. For the full application, deploy the Node server and PostgreSQL database on a backend-capable host and point the frontend/API to that deployment.

If frontend and API use different origins, set `CORS_ORIGIN` to the exact frontend origin(s), comma-separated. Do not use `*`.

## Database files

- `database/schema.sql` — canonical schema for new installations.
- `database/backups/SIH26122_postgres_full.sql` — original full PostgreSQL dump retained as a reference/backup artifact.

## Validation

Run:

```bash
npm run check
```

This checks the Node backend, database module, email service and browser JavaScript for syntax errors.
