-- SitePulse canonical project foundation.
-- This migration is additive and safe to apply to an existing database.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  client_name VARCHAR(255),
  contractor_name VARCHAR(255),
  project_manager VARCHAR(255),
  site_engineer VARCHAR(255),
  location_text VARCHAR(500),
  project_type VARCHAR(100),
  start_date DATE,
  planned_completion_date DATE,
  total_duration_days INTEGER CHECK (total_duration_days IS NULL OR total_duration_days >= 0),
  unit_system VARCHAR(32) NOT NULL DEFAULT 'metric',
  description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (planned_completion_date IS NULL OR start_date IS NULL OR planned_completion_date >= start_date)
);

CREATE TABLE IF NOT EXISTS project_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  summary TEXT NOT NULL,
  created_by VARCHAR(255) NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, revision_number)
);

CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category VARCHAR(32) NOT NULL CHECK (category IN ('drawing','bim','schedule','dpr','site_capture','report')),
  original_name VARCHAR(500) NOT NULL,
  object_key VARCHAR(1024) NOT NULL UNIQUE,
  content_type VARCHAR(128) NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  checksum_sha256 CHAR(64),
  source VARCHAR(32) NOT NULL DEFAULT 'upload',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  job_type VARCHAR(64) NOT NULL CHECK (job_type IN ('ocr','schedule_import','image_quality','alignment','construction_cv','progress','future_simulation','report')),
  state VARCHAR(32) NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','processing','completed','failed','review_required','unavailable')),
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS canonical_project_states (
  project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_status VARCHAR(32) NOT NULL DEFAULT 'review_required' CHECK (evidence_status IN ('observed','calculated','predicted','synthetic_demo','review_required')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS canonical_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type VARCHAR(64) NOT NULL,
  entity_id UUID,
  action VARCHAR(64) NOT NULL,
  actor VARCHAR(255) NOT NULL DEFAULT 'system',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_files_project_category ON project_files(project_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_project_state ON processing_jobs(project_id, state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_canonical_audit_project_time ON canonical_audit_events(project_id, created_at DESC);
