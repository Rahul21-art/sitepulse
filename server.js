/**
 * SitePulse backend
 * - Serves the static frontend from /frontend
 * - Keeps SMTP credentials server-side
 * - Exposes PostgreSQL-backed APIs
 * - Adds basic production security controls
 */
'use strict';

require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const { getPool, isDatabaseConfigured, query } = require('./backend/db/database');
const { sendActionEmail, isEmailConfigured } = require('./backend/email');
const { createProject, getProject, listProjects } = require('./backend/projects');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '127.0.0.1';
const FRONTEND_DIR = path.resolve(__dirname, 'frontend');
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 100 * 1024);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '';
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 30);
const rateBuckets = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const protocol = req.socket.encrypted ? 'https' : 'http';
  const sameOrigin = `${protocol}://${req.headers.host}`;
  // Browser fetch requests include Origin even when the page and API share
  // this server. Same-origin API calls must not require CORS configuration.
  if (origin === sameOrigin) return true;
  if (!CORS_ORIGIN) return false;
  const allowed = CORS_ORIGIN.split(',').map(v => v.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return true;
}

function rateLimit(req) {
  const key = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.start >= RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(key, { start: now, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_MAX;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body is too large.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error('Request body must be valid JSON.'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function cleanString(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function emailErrorMessage(error) {
  if (error?.code === 'EAUTH') {
    return 'Gmail rejected the SMTP sign-in. Generate a new Gmail App Password and update SMTP_PASS.';
  }
  if (error?.code === 'ERESEND') {
    return error.message || 'Resend could not accept the email request. Check RESEND_API_KEY and RESEND_FROM.';
  }
  if (error?.code === 'EEMAILJS') {
    return error.message || 'EmailJS could not accept the email request. Check the EmailJS service and template settings.';
  }
  if (['ETIMEDOUT', 'ECONNECTION', 'ESOCKET'].includes(error?.code)) {
    return 'The server could not connect to Gmail SMTP. Check the network and SMTP host/port settings.';
  }
  if (error?.statusCode === 502 || error?.code === 'EENVELOPE') {
    return error.message || 'The mail provider rejected the recipient address.';
  }
  return 'The email could not be sent. Check the server logs for the SMTP error.';
}

function safeFilePath(requestPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  if (pathname.includes('\0')) return null;
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = path.resolve(FRONTEND_DIR, relative);
  if (candidate !== FRONTEND_DIR && !candidate.startsWith(FRONTEND_DIR + path.sep)) return null;
  return candidate;
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, {
      status: 'ok',
      databaseConfigured: isDatabaseConfigured(),
      emailConfigured: isEmailConfigured()
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/activities') {
    if (!isDatabaseConfigured()) {
      return json(res, 503, { error: 'PostgreSQL is not configured. Using frontend baseline.' });
    }
    const result = await query(
      `SELECT activity_id, activity_name, discipline, planned_start_date, planned_end_date
       FROM project_activities ORDER BY planned_start_date, activity_id`
    );
    return json(res, 200, result.rows);
  }

  if (req.method === 'GET' && url.pathname === '/api/processing-capabilities') {
    return json(res, 200, {
      documentOcr: { state: 'unavailable', reason: 'PaddleOCR processing service is not configured.' },
      constructionCv: { state: 'unavailable', reason: 'A validated construction YOLO model is not configured.' },
      bim: { state: 'unavailable', reason: 'IFC processing service is not configured.' },
      reconstruction: { state: 'unavailable', reason: 'COLMAP/OpenMVS processing service is not configured.' },
      riskModel: { state: 'unavailable', reason: 'Historical project data and an XGBoost service are not configured.' },
      browserAlignment: { state: 'available', limitation: 'Manual four-point visual alignment only; not semantic construction verification.' }
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/projects') {
    if (!isDatabaseConfigured()) return json(res, 503, { error: 'PostgreSQL is required for project records.' });
    return json(res, 200, await listProjects());
  }

  if (req.method === 'POST' && url.pathname === '/api/projects') {
    if (!isDatabaseConfigured()) return json(res, 503, { error: 'PostgreSQL is required for project records.' });
    const project = await createProject(await readJson(req));
    return json(res, 201, { success: true, project });
  }

  const projectMatch = url.pathname.match(/^\/api\/projects\/([0-9a-f-]{36})$/i);
  if (req.method === 'GET' && projectMatch) {
    if (!isDatabaseConfigured()) return json(res, 503, { error: 'PostgreSQL is required for project records.' });
    const project = await getProject(projectMatch[1]);
    return project ? json(res, 200, project) : json(res, 404, { error: 'Project not found.' });
  }

  if (req.method === 'POST' && url.pathname === '/api/send-email') {
    const data = await readJson(req);
    const managerName = cleanString(data.managerName, 100);
    const managerEmail = cleanString(data.managerEmail, 254).toLowerCase();
    const priority = cleanString(data.priority, 80);
    const remarks = cleanString(data.remarks, 2000);
    const recTitle = cleanString(data.recTitle, 300);

    if (!managerName || !validEmail(managerEmail) || !recTitle) {
      return json(res, 400, { success: false, error: 'Manager name, valid recipient email and recommendation title are required.' });
    }
    if (!['URGENT — Immediate Action Required', 'HIGH — Schedule Recovery', 'STANDARD — Field Notice'].includes(priority)) {
      return json(res, 400, { success: false, error: 'Invalid priority.' });
    }
    if (!isEmailConfigured()) {
      return json(res, 503, {
        success: false,
        error: 'Email delivery is not configured on the server. Configure EmailJS, Resend, or SMTP variables.'
      });
    }

    let result;
    try {
      result = await sendActionEmail({ managerName, managerEmail, priority, remarks, recTitle });
    } catch (error) {
      console.error('[EMAIL]', error.code || error.name, error.message);
      return json(res, error.statusCode || 502, { success: false, error: emailErrorMessage(error) });
    }
    return json(res, 200, {
      success: true,
      emailSent: true,
      recipient: result.recipient,
      message: 'Action plan sent securely by the SitePulse backend.'
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/assessments') {
    const data = await readJson(req);
    const activityId = cleanString(data.activityId, 10);
    const activityName = cleanString(data.activityName, 255);
    const plannedStart = cleanString(data.plannedStart, 10);
    const plannedEnd = cleanString(data.plannedEnd, 10);
    const updateDate = cleanString(data.updateDate, 10);
    const actualProgress = Number(data.actualProgress);
    const expectedProgress = Number(data.expectedProgress);
    const variance = Number(data.variance);
    const reportedBy = cleanString(data.reportedBy, 50) || 'Site Engineer / Inspector';
    const zone = cleanString(data.zone, 255) || 'Unspecified work area';
    const observation = cleanString(data.observation, 2000);
    const blueprintName = cleanString(data.blueprintName, 255);
    const sitePhotoName = cleanString(data.sitePhotoName, 255);

    if (!activityId || !activityName || !/^\d{4}-\d{2}-\d{2}$/.test(updateDate) ||
        !Number.isFinite(actualProgress) || actualProgress < 0 || actualProgress > 100 ||
        !Number.isFinite(expectedProgress) || expectedProgress < 0 || expectedProgress > 100 ||
        !Number.isFinite(variance)) {
      return json(res, 400, { success: false, error: 'Invalid assessment fields.' });
    }
    if (!isDatabaseConfigured()) {
      return json(res, 503, { success: false, error: 'PostgreSQL is not configured. Assessment was not persisted.' });
    }

    const reportId = `SR-${Date.now().toString(36).toUpperCase().slice(-8)}`.slice(0, 10);
    const eventId = `PE-${Date.now().toString(36).toUpperCase().slice(-8)}`.slice(0, 10);
    const rawReport = [
      `Digital assessment for ${activityId} — ${activityName}.`,
      `Zone: ${zone}.`,
      `Update date: ${updateDate}.`,
      `Actual progress: ${actualProgress}%; expected: ${expectedProgress}%; variance: ${variance}%.`,
      `Blueprint: ${blueprintName || 'not named'}. Site photo: ${sitePhotoName || 'not named'}.`,
      observation ? `Observation: ${observation}` : ''
    ].filter(Boolean).join(' ');

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO site_reports (report_id, report_date, reported_by, weather, raw_report_text)
         VALUES ($1, $2, $3, $4, $5)`,
        [reportId, data.reportDate || updateDate, reportedBy, null, rawReport]
      );

      const extractedStatus = variance < -10 ? 'delayed' : variance < 0 ? 'in_progress' : 'complete';
      await client.query(
        `INSERT INTO progress_events
         (event_id, report_id, normalized_date, activity_mention_text, extracted_status,
          extracted_progress_pct, pct_is_estimated, extraction_confidence, extraction_method)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [eventId, reportId, updateDate, `${activityName} — ${zone}`, extractedStatus,
         actualProgress, false, 0.96, 'rule_based']
      );
      await client.query('COMMIT');
      return json(res, 201, { success: true, reportId, eventId, status: 'saved' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return json(res, 404, { error: 'API route not found.' });
}

const server = http.createServer(async (req, res) => {
  securityHeaders(res);

  if (!applyCors(req, res)) {
    return json(res, 403, { error: 'Origin is not allowed.' });
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (!rateLimit(req)) {
    return json(res, 429, { error: 'Too many requests. Please try again shortly.' });
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    if (url.pathname.startsWith('/api/')) {
      return await handleApi(req, res, url);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return json(res, 405, { error: 'Method not allowed.' });
    }

    const filePath = safeFilePath(url.pathname);
    if (!filePath) return json(res, 400, { error: 'Invalid path.' });

    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code === 'ENOENT') return json(res, 404, { error: 'Not found.' });
        console.error('[STATIC]', error);
        return json(res, 500, { error: 'Unable to read resource.' });
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
      });
      if (req.method === 'HEAD') return res.end();
      res.end(content);
    });
  } catch (error) {
    console.error('[API]', error);
    json(res, error.statusCode || 500, {
      error: error.statusCode ? error.message : 'Internal server error.'
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`SitePulse running at http://${HOST}:${PORT}`);
  console.log(`PostgreSQL: ${isDatabaseConfigured() ? 'configured' : 'not configured (frontend fallback active)'}`);
  console.log(`Email: ${isEmailConfigured() ? 'configured' : 'not configured'}`);
});

function shutdown(signal) {
  console.log(`${signal}: shutting down SitePulse...`);
  const pool = getPool();
  if (pool) pool.end().finally(() => process.exit(0));
  else process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
