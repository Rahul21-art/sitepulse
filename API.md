# SitePulse API

All API responses are JSON. The Node API requires PostgreSQL for canonical project routes.

## Implemented routes

| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/health` | API, database and mail configuration status |
| GET | `/api/processing-capabilities` | Truthful OCR/CV/BIM/reconstruction availability |
| GET | `/api/projects` | List canonical projects |
| POST | `/api/projects` | Create a project and initial audit/state records |
| GET | `/api/projects/:id` | Project, file metadata, jobs and canonical state |
| GET | `/api/activities` | Legacy schedule-baseline activities |
| POST | `/api/assessments` | Legacy assessment persistence |
| POST | `/api/send-email` | Send an action plan through configured server-side provider |

## Create project

```json
{
  "projectCode": "SIH26122-A",
  "name": "Metro Corridor — Package A",
  "clientName": "Example client",
  "contractorName": "Example contractor",
  "projectManager": "Project manager",
  "siteEngineer": "Site engineer",
  "locationText": "City, State",
  "projectType": "Road corridor",
  "startDate": "2026-09-16",
  "plannedCompletionDate": "2027-09-16",
  "totalDurationDays": 365,
  "unitSystem": "metric",
  "description": "Optional project description"
}
```

The route creates a revision, empty canonical state, and audit event atomically. Upload/schedule/DPR/capture APIs remain queued for the next implementation phase rather than silently accepting files without safe storage.
