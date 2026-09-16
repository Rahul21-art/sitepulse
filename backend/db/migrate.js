'use strict';

const fs = require('fs');
const path = require('path');
const { getPool, isDatabaseConfigured } = require('./database');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../database/migrations');

async function migrate() {
  if (!isDatabaseConfigured()) throw new Error('PostgreSQL is not configured. Set DATABASE_URL or PG* variables first.');
  const pool = getPool();
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(name => /^\d+_.+\.sql$/.test(name)).sort();
  for (const file of files) {
    const already = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]);
    if (already.rowCount) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

migrate().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
