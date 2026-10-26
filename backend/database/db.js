import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFileName = process.env.DB_FILE || (process.env.NODE_ENV === 'test' ? 'carebridge.test.sqlite' : 'carebridge.sqlite');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, dbFileName);
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Enable verbose SQLite logging in dev if needed
const sqlite = sqlite3.verbose();
let transactionQueue = Promise.resolve();

export const db = new sqlite.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open CareBridge SQLite database:', err);
  } else {
    console.log('Connected to CareBridge SQLite database at:', DB_PATH);
  }
});

// Helper for running SQL with promises
export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// Helper for fetching single row
export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// Helper for fetching all matching rows
export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// Initialize tables from schema.sql
export async function initDatabase() {
  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  await new Promise((resolve, reject) => {
    db.exec(schemaSql, (err) => {
      if (err) {
        console.error('Failed to execute schema SQL:', err);
        return reject(err);
      }
      console.log('CareBridge database schema initialized successfully.');
      resolve(true);
    });
  });

  // Migrations for existing databases
  const migrations = [
    `ALTER TABLE discharge_requests ADD COLUMN clarification_reason TEXT`,
    `ALTER TABLE patients ADD COLUMN doctor_assessed_risk TEXT`,
    `ALTER TABLE patients ADD COLUMN clinical_status TEXT DEFAULT 'STABLE'`,
    `ALTER TABLE patients ADD COLUMN system_calculated_risk TEXT`,
    `ALTER TABLE patients ADD COLUMN risk_reconciliation_status TEXT DEFAULT 'MATCH'`,
    `ALTER TABLE users ADD COLUMN username TEXT`,
    `ALTER TABLE users ADD COLUMN doctor_id TEXT`,
    `ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1`,
    `ALTER TABLE users ADD COLUMN last_login DATETIME`,
    `ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'ACTIVE'`,
    `ALTER TABLE doctors ADD COLUMN department TEXT`,
    `ALTER TABLE doctors ADD COLUMN qualification TEXT`,
    `ALTER TABLE doctors ADD COLUMN contact TEXT`,
    `ALTER TABLE doctors ADD COLUMN shift TEXT DEFAULT 'DAY'`,
    `ALTER TABLE doctors ADD COLUMN account_status TEXT DEFAULT 'ACTIVE'`,
    `ALTER TABLE conflicts ADD COLUMN patient_id TEXT`
  ];

  for (const m of migrations) {
    try {
      await run(m);
    } catch (e) {
      // Ignore "duplicate column name" error if column already exists
    }
  }

  return true;
}

// Execute transaction
export async function transaction(asyncCallback) {
  const operation = transactionQueue.then(async () => {
    await run('BEGIN IMMEDIATE TRANSACTION');
    try {
      const result = await asyncCallback();
      await run('COMMIT');
      return result;
    } catch (err) {
      await run('ROLLBACK');
      throw err;
    }
  });

  transactionQueue = operation.catch(() => undefined);
  return operation;
}
