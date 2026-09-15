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

The browser sends only the recipient and message data. SMTP credentials never leave the backend.

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
