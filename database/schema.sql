-- =====================================================================
-- SIH26122 — PostgreSQL schema (migrated from SQLite)
--
-- Pipeline:
--   project_activities ─┐
--                        ├─▶ progress_events ─▶ activity_matches ─▶ audit_logs
--   site_reports ───────┘
--
-- Changes made relative to the SQLite version:
--   - BOOLEAN is a native type in Postgres (SQLite stored it as 0/1
--     INTEGER) — pct_is_estimated and is_selected are now true BOOLEAN.
--   - TIMESTAMP defaults use PostgreSQL's CURRENT_TIMESTAMP (same
--     keyword, native type here rather than SQLite's text affinity).
--   - CHECK constraints are unchanged in syntax but are actually
--     enforced at write time in Postgres (SQLite enforces them too,
--     but Postgres additionally validates on ALTER/backfill).
--   - Tables are created in dependency order (activities/reports before
--     the tables that FK into them) since Postgres, unlike SQLite by
--     default, always enforces FK constraints immediately.
--   - VARCHAR/TEXT/DECIMAL/DATE map 1:1, no changes needed there.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Table: project_activities
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS activity_matches;
DROP TABLE IF EXISTS progress_events;
DROP TABLE IF EXISTS site_reports;
DROP TABLE IF EXISTS project_activities;

CREATE TABLE project_activities (
    activity_id         VARCHAR(10)   PRIMARY KEY,
    activity_name       VARCHAR(255)  NOT NULL,
    discipline          VARCHAR(50)   NOT NULL,
    planned_start_date  DATE          NOT NULL,
    planned_end_date    DATE          NOT NULL,

    CONSTRAINT ck_activity_dates CHECK (planned_end_date >= planned_start_date)
);

CREATE INDEX idx_activities_discipline ON project_activities (discipline);
CREATE INDEX idx_activities_start_date ON project_activities (planned_start_date);

-- ---------------------------------------------------------------------
-- Table: site_reports
-- report_date stays VARCHAR — the source data mixes date formats
-- (05-02-2026, 2026/02/18, "22 Feb 26"...) and casting to DATE at the
-- schema level would silently normalize/lose that. Parsed dates belong
-- in progress_events.normalized_date instead.
-- ---------------------------------------------------------------------
CREATE TABLE site_reports (
    report_id           VARCHAR(10)   PRIMARY KEY,
    report_date         VARCHAR(20)   NOT NULL,
    reported_by         VARCHAR(50),
    weather              VARCHAR(20),
    raw_report_text      TEXT          NOT NULL
);

CREATE INDEX idx_reports_date ON site_reports (report_date);
CREATE INDEX idx_reports_by   ON site_reports (reported_by);

-- ---------------------------------------------------------------------
-- Table: progress_events
-- ---------------------------------------------------------------------
CREATE TABLE progress_events (
    event_id                 VARCHAR(10)   PRIMARY KEY,
    report_id                VARCHAR(10)   NOT NULL REFERENCES site_reports (report_id),
    normalized_date          DATE,
    activity_mention_text    VARCHAR(255)  NOT NULL,
    extracted_status         VARCHAR(20)   NOT NULL
        CHECK (extracted_status IN ('not_started','in_progress','delayed','complete','ambiguous')),
    extracted_progress_pct   DECIMAL(5,2)
        CHECK (extracted_progress_pct IS NULL OR extracted_progress_pct BETWEEN 0 AND 100),
    pct_is_estimated         BOOLEAN       NOT NULL DEFAULT FALSE,
    extraction_confidence    DECIMAL(3,2)  NOT NULL CHECK (extraction_confidence BETWEEN 0 AND 1),
    extraction_method        VARCHAR(20)   NOT NULL DEFAULT 'manual'
        CHECK (extraction_method IN ('rule_based','llm','manual')),
    created_at                TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_report ON progress_events (report_id);
CREATE INDEX idx_events_status ON progress_events (extracted_status);
CREATE INDEX idx_events_date   ON progress_events (normalized_date);

-- ---------------------------------------------------------------------
-- Table: activity_matches
-- ---------------------------------------------------------------------
CREATE TABLE activity_matches (
    match_id           VARCHAR(10)   PRIMARY KEY,
    event_id           VARCHAR(10)   NOT NULL REFERENCES progress_events (event_id),
    activity_id        VARCHAR(10)   REFERENCES project_activities (activity_id),
    match_rank         INTEGER       NOT NULL DEFAULT 1,
    match_confidence   DECIMAL(3,2)  NOT NULL CHECK (match_confidence BETWEEN 0 AND 1),
    match_method        VARCHAR(20)  NOT NULL DEFAULT 'keyword'
        CHECK (match_method IN ('keyword','fuzzy','embedding','manual')),
    is_selected          BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_matches_event_rank UNIQUE (event_id, match_rank)
);

CREATE INDEX idx_matches_event    ON activity_matches (event_id);
CREATE INDEX idx_matches_activity ON activity_matches (activity_id);

-- ---------------------------------------------------------------------
-- Table: audit_logs
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
    audit_id       VARCHAR(10)   PRIMARY KEY,
    entity_table   VARCHAR(30)   NOT NULL
        CHECK (entity_table IN ('site_reports','project_activities','progress_events','activity_matches')),
    entity_id      VARCHAR(10)   NOT NULL,
    action         VARCHAR(20)   NOT NULL
        CHECK (action IN ('CREATE','UPDATE','REVIEW','OVERRIDE','DELETE')),
    field_changed  VARCHAR(50),
    old_value      TEXT,
    new_value      TEXT,
    changed_by     VARCHAR(50)   NOT NULL,
    changed_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    remarks        TEXT
);

CREATE INDEX idx_audit_entity ON audit_logs (entity_table, entity_id);
CREATE INDEX idx_audit_action ON audit_logs (action);
CREATE INDEX idx_audit_time   ON audit_logs (changed_at);

COMMIT;