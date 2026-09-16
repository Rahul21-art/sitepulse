'use strict';

const { randomUUID } = require('crypto');
const { getPool } = require('./db/database');

function text(value, max = 500) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function date(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? value : null; }

function normaliseProject(input) {
  const project = {
    projectCode: text(input.projectCode, 64).toUpperCase(), name: text(input.name, 255),
    clientName: text(input.clientName, 255), contractorName: text(input.contractorName, 255),
    projectManager: text(input.projectManager, 255), siteEngineer: text(input.siteEngineer, 255),
    locationText: text(input.locationText, 500), projectType: text(input.projectType, 100),
    startDate: date(input.startDate), plannedCompletionDate: date(input.plannedCompletionDate),
    totalDurationDays: Number.isInteger(Number(input.totalDurationDays)) ? Number(input.totalDurationDays) : null,
    unitSystem: ['metric', 'imperial'].includes(input.unitSystem) ? input.unitSystem : 'metric',
    description: text(input.description, 5000)
  };
  if (!project.projectCode || !project.name) throw Object.assign(new Error('projectCode and name are required.'), { statusCode: 400 });
  if (project.totalDurationDays !== null && project.totalDurationDays < 0) throw Object.assign(new Error('totalDurationDays cannot be negative.'), { statusCode: 400 });
  if (project.startDate && project.plannedCompletionDate && project.plannedCompletionDate < project.startDate) throw Object.assign(new Error('plannedCompletionDate must be on or after startDate.'), { statusCode: 400 });
  return project;
}

async function writeAudit(client, projectId, action, details, entityType = 'project', entityId = null) {
  await client.query(
    `INSERT INTO canonical_audit_events(project_id, entity_type, entity_id, action, details)
     VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [projectId, entityType, entityId, action, JSON.stringify(details)]
  );
}

async function createProject(input) {
  const project = normaliseProject(input);
  const pool = getPool(); const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = randomUUID();
    const result = await client.query(
      `INSERT INTO projects(id, project_code, name, client_name, contractor_name, project_manager, site_engineer, location_text, project_type, start_date, planned_completion_date, total_duration_days, unit_system, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [id, project.projectCode, project.name, project.clientName || null, project.contractorName || null, project.projectManager || null, project.siteEngineer || null, project.locationText || null, project.projectType || null, project.startDate, project.plannedCompletionDate, project.totalDurationDays, project.unitSystem, project.description || null]
    );
    await client.query('INSERT INTO project_revisions(project_id, revision_number, summary) VALUES ($1, 1, $2)', [id, 'Project initialized']);
    await client.query(`INSERT INTO canonical_project_states(project_id, state, evidence_status) VALUES ($1, $2::jsonb, 'review_required')`, [id, JSON.stringify({ project: { id, code: project.projectCode, name: project.name }, drawings: [], schedule: [], captures: [], observations: [], progress: null, risk: null })]);
    await writeAudit(client, id, 'PROJECT_CREATED', { source: 'api', projectCode: project.projectCode });
    await client.query('COMMIT'); return result.rows[0];
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

async function getProject(id) {
  const pool = getPool();
  const project = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
  if (!project.rowCount) return null;
  const [state, files, jobs] = await Promise.all([
    pool.query('SELECT state, evidence_status, updated_at FROM canonical_project_states WHERE project_id = $1', [id]),
    pool.query('SELECT id, category, original_name, content_type, byte_size, metadata, created_at FROM project_files WHERE project_id = $1 ORDER BY created_at DESC LIMIT 100', [id]),
    pool.query('SELECT id, job_type, state, output, error_message, created_at, updated_at FROM processing_jobs WHERE project_id = $1 ORDER BY created_at DESC LIMIT 50', [id])
  ]);
  return { ...project.rows[0], canonicalState: state.rows[0] || null, files: files.rows, jobs: jobs.rows };
}

async function listProjects() { return (await getPool().query('SELECT * FROM projects ORDER BY updated_at DESC LIMIT 100')).rows; }

module.exports = { createProject, getProject, listProjects };
