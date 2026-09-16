'use strict';

const { randomUUID } = require('crypto');
const { getPool } = require('./db/database');

function text(value, max = 255) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function isoDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? value : null; }
function number(value) { const output = Number(value); return Number.isFinite(output) ? output : null; }
function fail(message) { throw Object.assign(new Error(message), { statusCode: 400 }); }

function normaliseActivity(row) {
  const result = {
    activityCode: text(row.activityCode, 64), activityName: text(row.activityName, 255),
    wbsCode: text(row.wbsCode, 255), parentWbs: text(row.parentWbs, 255), zone: text(row.zone, 255), floor: text(row.floor, 255),
    plannedStart: isoDate(row.plannedStart), plannedFinish: isoDate(row.plannedFinish), plannedQuantity: number(row.plannedQuantity),
    quantityUnit: text(row.quantityUnit, 32), weight: number(row.weight), responsibleParty: text(row.responsibleParty, 255)
  };
  if (!result.activityCode || !result.activityName || !result.plannedStart || !result.plannedFinish) fail('Every activity needs activityCode, activityName, plannedStart, and plannedFinish.');
  if (result.plannedFinish < result.plannedStart) fail(`Activity ${result.activityCode} finishes before it starts.`);
  if (result.plannedQuantity !== null && result.plannedQuantity < 0) fail(`Activity ${result.activityCode} has an invalid plannedQuantity.`);
  if (result.weight === null || result.weight < 0 || result.weight > 1) fail(`Activity ${result.activityCode} requires a weight between 0 and 1.`);
  return result;
}

async function audit(client, projectId, action, details, entityType, entityId) {
  await client.query('INSERT INTO canonical_audit_events(project_id, entity_type, entity_id, action, details) VALUES ($1,$2,$3,$4,$5::jsonb)', [projectId, entityType, entityId || null, action, JSON.stringify(details)]);
}

async function importSchedule(projectId, rawActivities) {
  if (!Array.isArray(rawActivities) || !rawActivities.length || rawActivities.length > 5000) fail('activities must contain between 1 and 5000 records.');
  const activities = rawActivities.map(normaliseActivity);
  const seen = new Set(); activities.forEach(item => { if (seen.has(item.activityCode)) fail(`Duplicate activityCode: ${item.activityCode}`); seen.add(item.activityCode); });
  const pool = getPool(); const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const project = await client.query('SELECT id FROM projects WHERE id = $1 FOR UPDATE', [projectId]);
    if (!project.rowCount) throw Object.assign(new Error('Project not found.'), { statusCode: 404 });
    for (const item of activities) {
      await client.query(
        `INSERT INTO schedule_activities(project_id, activity_code, activity_name, wbs_code, parent_wbs, zone, floor, planned_start, planned_finish, planned_quantity, quantity_unit, weight, responsible_party)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT(project_id, activity_code) DO UPDATE SET activity_name=EXCLUDED.activity_name,wbs_code=EXCLUDED.wbs_code,parent_wbs=EXCLUDED.parent_wbs,zone=EXCLUDED.zone,floor=EXCLUDED.floor,planned_start=EXCLUDED.planned_start,planned_finish=EXCLUDED.planned_finish,planned_quantity=EXCLUDED.planned_quantity,quantity_unit=EXCLUDED.quantity_unit,weight=EXCLUDED.weight,responsible_party=EXCLUDED.responsible_party,updated_at=CURRENT_TIMESTAMP`,
        [projectId, item.activityCode, item.activityName, item.wbsCode || null, item.parentWbs || null, item.zone || null, item.floor || null, item.plannedStart, item.plannedFinish, item.plannedQuantity, item.quantityUnit || null, item.weight, item.responsibleParty || null]
      );
    }
    await audit(client, projectId, 'SCHEDULE_IMPORTED', { activityCount: activities.length }, 'schedule', null);
    await client.query('COMMIT'); return { activityCount: activities.length };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

function plannedPercent(activity, asOf) {
  const start = new Date(`${activity.planned_start}T00:00:00Z`).getTime(); const finish = new Date(`${activity.planned_finish}T00:00:00Z`).getTime(); const at = new Date(`${asOf}T00:00:00Z`).getTime();
  if (at < start) return 0; if (at >= finish || start === finish) return 100;
  return Math.round(((at - start) / (finish - start)) * 10000) / 100;
}

async function getProgress(projectId, asOf) {
  const result = await getPool().query(
    `SELECT a.*, p.actual_progress, p.recorded_on, p.evidence_status, p.source_type, p.evidence_note, p.formula
     FROM schedule_activities a
     LEFT JOIN LATERAL (SELECT * FROM progress_records WHERE activity_id = a.id AND recorded_on <= $2 ORDER BY recorded_on DESC, created_at DESC LIMIT 1) p ON TRUE
     WHERE a.project_id = $1 ORDER BY a.planned_start, a.activity_code`, [projectId, asOf]
  );
  if (!result.rowCount) return { asOf, activities: [], totals: null, message: 'No schedule activities have been imported.' };
  const totalWeight = result.rows.reduce((sum, row) => sum + Number(row.weight), 0) || result.rows.length;
  let plannedWeighted = 0; let actualWeighted = 0;
  const activities = result.rows.map(row => {
    const plannedProgress = plannedPercent(row, asOf); const actualProgress = row.actual_progress === null ? null : Number(row.actual_progress);
    const factor = Number(row.weight) || 1;
    plannedWeighted += plannedProgress * factor; actualWeighted += (actualProgress === null ? 0 : actualProgress) * factor;
    return { id: row.id, activityCode: row.activity_code, activityName: row.activity_name, zone: row.zone, floor: row.floor, plannedStart: row.planned_start, plannedFinish: row.planned_finish, plannedProgress, actualProgress, variance: actualProgress === null ? null : Math.round((actualProgress - plannedProgress) * 100) / 100, evidenceStatus: row.evidence_status || 'review_required', sourceType: row.source_type, evidenceNote: row.evidence_note, formula: row.formula };
  });
  const plannedProgress = Math.round(plannedWeighted / totalWeight * 100) / 100; const actualProgress = Math.round(actualWeighted / totalWeight * 100) / 100;
  return { asOf, activities, totals: { plannedProgress, actualProgress, variance: Math.round((actualProgress - plannedProgress) * 100) / 100, note: 'Actual totals treat missing verified activity records as 0. Review required until all relevant records are supplied.' } };
}

async function addProgressRecord(projectId, activityId, input) {
  const recordedOn = isoDate(input.recordedOn); const actualProgress = number(input.actualProgress); const completedQuantity = number(input.completedQuantity);
  const sourceType = text(input.sourceType, 32); const evidenceNote = text(input.evidenceNote, 5000); const createdBy = text(input.createdBy, 255) || 'Site Engineer';
  if (!recordedOn || actualProgress === null || actualProgress < 0 || actualProgress > 100) fail('recordedOn and actualProgress (0-100) are required.');
  if (!['manual', 'dpr', 'cv_observation', 'quantity_measurement'].includes(sourceType)) fail('Invalid sourceType.');
  const pool = getPool(); const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const activity = await client.query('SELECT id, planned_quantity, quantity_unit FROM schedule_activities WHERE id=$1 AND project_id=$2', [activityId, projectId]);
    if (!activity.rowCount) throw Object.assign(new Error('Activity not found.'), { statusCode: 404 });
    const formula = completedQuantity !== null && activity.rows[0].planned_quantity !== null ? { type: 'quantity_ratio', completedQuantity, plannedQuantity: Number(activity.rows[0].planned_quantity), unit: activity.rows[0].quantity_unit, calculatedProgress: Math.round(completedQuantity / Number(activity.rows[0].planned_quantity) * 10000) / 100 } : { type: 'manual_entry', enteredProgress: actualProgress };
    const id = randomUUID();
    await client.query(`INSERT INTO progress_records(id, project_id, activity_id, recorded_on, actual_progress, completed_quantity, source_type, evidence_status, evidence_note, formula, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,'review_required',$8,$9::jsonb,$10)`, [id, projectId, activityId, recordedOn, actualProgress, completedQuantity, sourceType, evidenceNote || null, JSON.stringify(formula), createdBy]);
    await audit(client, projectId, 'PROGRESS_RECORDED', { activityId, actualProgress, sourceType, evidenceStatus: 'review_required' }, 'progress_record', id);
    await client.query('COMMIT'); return { id, evidenceStatus: 'review_required', formula };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

module.exports = { importSchedule, getProgress, addProgressRecord };
