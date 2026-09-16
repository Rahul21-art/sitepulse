-- Deterministic schedule, progress evidence, and human review.

CREATE TABLE IF NOT EXISTS schedule_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_code VARCHAR(64) NOT NULL,
  activity_name VARCHAR(255) NOT NULL,
  wbs_code VARCHAR(255),
  parent_wbs VARCHAR(255),
  zone VARCHAR(255),
  floor VARCHAR(255),
  planned_start DATE NOT NULL,
  planned_finish DATE NOT NULL,
  planned_quantity NUMERIC(14,3),
  quantity_unit VARCHAR(32),
  weight NUMERIC(9,6) NOT NULL DEFAULT 0 CHECK (weight >= 0 AND weight <= 1),
  responsible_party VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','complete','delayed','blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, activity_code),
  CHECK (planned_finish >= planned_start)
);

CREATE TABLE IF NOT EXISTS activity_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  predecessor_activity_id UUID NOT NULL REFERENCES schedule_activities(id) ON DELETE CASCADE,
  successor_activity_id UUID NOT NULL REFERENCES schedule_activities(id) ON DELETE CASCADE,
  dependency_type VARCHAR(2) NOT NULL DEFAULT 'FS' CHECK (dependency_type IN ('FS','SS','FF','SF')),
  lag_days INTEGER NOT NULL DEFAULT 0,
  UNIQUE(predecessor_activity_id, successor_activity_id, dependency_type)
);

CREATE TABLE IF NOT EXISTS progress_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES schedule_activities(id) ON DELETE CASCADE,
  recorded_on DATE NOT NULL,
  actual_progress NUMERIC(5,2) NOT NULL CHECK (actual_progress BETWEEN 0 AND 100),
  completed_quantity NUMERIC(14,3),
  source_type VARCHAR(32) NOT NULL CHECK (source_type IN ('manual','dpr','cv_observation','quantity_measurement')),
  evidence_status VARCHAR(32) NOT NULL DEFAULT 'review_required' CHECK (evidence_status IN ('observed','calculated','predicted','synthetic_demo','review_required','verified','rejected')),
  evidence_note TEXT,
  formula JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) NOT NULL DEFAULT 'Site Engineer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS review_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type VARCHAR(64) NOT NULL,
  entity_id UUID NOT NULL,
  decision VARCHAR(32) NOT NULL CHECK (decision IN ('accept','reject','edit','override')),
  prior_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  new_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewer VARCHAR(255) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schedule_activities_project_dates ON schedule_activities(project_id, planned_start, planned_finish);
CREATE INDEX IF NOT EXISTS idx_progress_records_activity_date ON progress_records(activity_id, recorded_on DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_actions_project_time ON review_actions(project_id, created_at DESC);
