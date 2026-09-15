'use strict';

let Pool;
try {
  ({ Pool } = require('pg'));
} catch {
  Pool = null;
}

let pool = null;

function isDatabaseConfigured() {
  return Boolean(
    Pool &&
    (process.env.DATABASE_URL ||
      (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE))
  );
}

function getPool() {
  if (!isDatabaseConfigured()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || undefined,
      host: process.env.PGHOST || undefined,
      port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
      user: process.env.PGUSER || undefined,
      password: process.env.PGPASSWORD || undefined,
      database: process.env.PGDATABASE || undefined,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.PGPOOL_MAX || 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
  }
  return pool;
}

async function query(text, params) {
  const activePool = getPool();
  if (!activePool) throw new Error('PostgreSQL is not configured or the pg package is missing.');
  return activePool.query(text, params);
}

module.exports = { getPool, isDatabaseConfigured, query };
