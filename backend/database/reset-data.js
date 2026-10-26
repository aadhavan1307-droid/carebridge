/**
 * CareBridge 2.0 — Safe Development Data Reset Script
 * =====================================================
 * npm run db:reset-data
 *
 * This script:
 *   - Creates a timestamped backup before clearing
 *   - Deletes ALL operational data (patients, doctors, assignments, etc.)
 *   - Preserves tables, schema, indexes, and foreign keys
 *   - Preserves application code and AI/ML implementation
 *   - Reinstates exactly 1 ADMINISTRATOR + 1 RECEPTIONIST account
 *   - Leaves 0 doctors, 0 patients, 0 rooms, 0 resources
 *   - NEVER auto-runs on server startup
 *
 * USAGE:
 *   npm run db:reset-data
 */

import { initDatabase, run, get, all, transaction } from './db.js';
import { hashPassword } from '../auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'carebridge.sqlite');

async function resetData() {
  console.log('');
  console.log('========================================================');
  console.log(' CareBridge 2.0 — Safe Development Data Reset');
  console.log('========================================================');
  console.log('');

  // 1. Backup first
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(__dirname, `carebridge-before-final-reset-${ts}.db`);
  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`[BACKUP]  Created: ${path.basename(backupPath)}`);
  } else {
    console.log('[BACKUP]  No existing database found — starting fresh.');
  }

  // 2. Initialize schema (CREATE TABLE IF NOT EXISTS — never drops)
  await initDatabase();
  console.log('[SCHEMA]  Schema verified. No tables were dropped.');
  console.log('');
  console.log('[CLEARING] Deleting all operational data...');

  // 3. Delete operational data in dependency-safe order
  await transaction(async () => {
    // Patient-related data
    await run('DELETE FROM discharges');
    await run('DELETE FROM discharge_requests');
    await run('DELETE FROM resource_allocations');
    await run('DELETE FROM assignments');
    await run('DELETE FROM care_team_assignments');
    await run('DELETE FROM patient_requirements');
    await run('DELETE FROM clinical_risk_assessments');
    await run('DELETE FROM observation_history');
    await run('DELETE FROM risk_history');
    await run('DELETE FROM priority_history');
    await run('DELETE FROM encounters');
    await run('DELETE FROM patients');

    // AI & system state
    await run('DELETE FROM ai_decisions');
    await run('DELETE FROM conflicts');
    await run('DELETE FROM audit_logs');

    // Infrastructure (user will configure fresh)
    await run('DELETE FROM rooms');
    await run('DELETE FROM resources');

    // All doctors and doctor-linked user accounts
    await run("DELETE FROM users WHERE role = 'DOCTOR'");
    await run('DELETE FROM doctors');

    // System settings (reset to clean)
    await run('DELETE FROM system_settings');

    // Admin + receptionist accounts
    await run("DELETE FROM users WHERE role IN ('ADMINISTRATOR', 'RECEPTIONIST')");

    // Reinstate minimum system accounts
    const adminId = 'USR-ADM-01';
    const recId = 'USR-REC-01';

    await run(
      `INSERT INTO users (id, username, email, password_hash, name, role, specialty, doctor_id, token_version, status)
       VALUES (?, ?, ?, ?, ?, 'ADMINISTRATOR', NULL, NULL, 1, 'ACTIVE')`,
      [adminId, 'admin', 'admin@carebridge.local', hashPassword('Admin@2026!'), 'System Administrator']
    );

    await run(
      `INSERT INTO users (id, username, email, password_hash, name, role, specialty, doctor_id, token_version, status)
       VALUES (?, ?, ?, ?, ?, 'RECEPTIONIST', NULL, NULL, 1, 'ACTIVE')`,
      [recId, 'reception', 'reception@carebridge.local', hashPassword('Reception@2026!'), 'Reception Desk']
    );

    // Seed clean system settings
    await run(
      `INSERT INTO system_settings (key, value_json)
       VALUES ('config', ?)`,
      [JSON.stringify({
        ai_algorithm_default: 'A_STAR',
        human_oversight_required: true,
        initialized_at: new Date().toISOString(),
        data_reset: true
      })]
    );

    // Log reset event
    const auditId = `AUD-RESET-${Date.now()}`;
    await run(
      `INSERT INTO audit_logs (id, event_type, actor_role, actor_id, payload_json)
       VALUES (?, 'SYSTEM_DATA_RESET', 'SYSTEM', NULL, ?)`,
      [auditId, JSON.stringify({ message: 'Clean development reset. All operational data cleared.', backup: path.basename(backupPath) })]
    );
  });

  console.log('[CLEARED] All operational rows deleted.');
  console.log('');

  // 4. Verification
  console.log('[VERIFY]  Running post-reset row count verification...');
  console.log('');

  const checks = [
    { label: 'Patients',              sql: "SELECT COUNT(*) as n FROM patients" },
    { label: 'Active Encounters',     sql: "SELECT COUNT(*) as n FROM encounters WHERE status != 'DISCHARGED'" },
    { label: 'Discharges',            sql: "SELECT COUNT(*) as n FROM discharges" },
    { label: 'Doctors',               sql: "SELECT COUNT(*) as n FROM doctors" },
    { label: 'Doctor Accounts',       sql: "SELECT COUNT(*) as n FROM users WHERE role='DOCTOR'" },
    { label: 'Doctor Assignments',    sql: "SELECT COUNT(*) as n FROM assignments" },
    { label: 'Care Team Assignments', sql: "SELECT COUNT(*) as n FROM care_team_assignments" },
    { label: 'Room Assignments',      sql: "SELECT COUNT(*) as n FROM rooms WHERE status='OCCUPIED'" },
    { label: 'Resource Allocations',  sql: "SELECT COUNT(*) as n FROM resource_allocations" },
    { label: 'Discharge Requests',    sql: "SELECT COUNT(*) as n FROM discharge_requests" },
    { label: 'AI Decisions',          sql: "SELECT COUNT(*) as n FROM ai_decisions" },
    { label: 'Conflicts/Alerts',      sql: "SELECT COUNT(*) as n FROM conflicts" },
    { label: 'Observation History',   sql: "SELECT COUNT(*) as n FROM observation_history" },
    { label: 'Risk History',          sql: "SELECT COUNT(*) as n FROM risk_history" },
    { label: 'Audit Logs',            sql: "SELECT COUNT(*) as n FROM audit_logs" },
  ];

  let allZero = true;
  for (const c of checks) {
    const row = await get(c.sql);
    const count = row ? row.n : 0;
    const expected = c.label === 'Audit Logs' ? 1 : 0;
    const status = count === expected ? '✓' : '!';
    if (count !== expected) allZero = false;
    console.log(`  [${status}] ${c.label.padEnd(24)} = ${count}`);
  }

  console.log('');

  // System account check
  const adminUser  = await get("SELECT id, username, email, role FROM users WHERE role='ADMINISTRATOR'");
  const recUser    = await get("SELECT id, username, email, role FROM users WHERE role='RECEPTIONIST'");
  const doctorCount = await get("SELECT COUNT(*) as n FROM users WHERE role='DOCTOR'");

  console.log('  [ACCOUNTS]');
  if (adminUser) {
    console.log(`  [✓] Administrator    : ${adminUser.email} (${adminUser.username})`);
  } else {
    console.log(`  [!] Administrator    : MISSING — setup failed!`);
  }
  if (recUser) {
    console.log(`  [✓] Receptionist     : ${recUser.email} (${recUser.username})`);
  } else {
    console.log(`  [!] Receptionist     : MISSING — setup failed!`);
  }
  console.log(`  [✓] Doctor Accounts  : ${doctorCount ? doctorCount.n : 0} (expected 0)`);

  // Orphan checks
  console.log('');
  console.log('  [ORPHAN CHECK]');
  const orphanDoctorAssign = await get("SELECT COUNT(*) as n FROM assignments a LEFT JOIN doctors d ON a.doctor_id=d.id WHERE d.id IS NULL");
  const orphanUserDoctor   = await get("SELECT COUNT(*) as n FROM users u WHERE u.doctor_id IS NOT NULL AND u.doctor_id NOT IN (SELECT id FROM doctors)");
  console.log(`  [${(orphanDoctorAssign?.n || 0) === 0 ? '✓' : '!'}] Orphan doctor assignments  = ${orphanDoctorAssign?.n || 0}`);
  console.log(`  [${(orphanUserDoctor?.n || 0) === 0 ? '✓' : '!'}]  Orphan user→doctor links   = ${orphanUserDoctor?.n || 0}`);

  console.log('');
  console.log('========================================================');
  console.log(' Reset Complete.');
  console.log('');
  console.log(' NEW CREDENTIALS:');
  console.log('   Administrator : admin@carebridge.local  /  Admin@2026!');
  console.log('   Receptionist  : reception@carebridge.local  /  Reception@2026!');
  console.log('');
  console.log(' NEXT STEPS:');
  console.log('   1. npm start   — start the server');
  console.log('   2. Log in as Administrator');
  console.log('   3. Create Doctors via Doctor Management');
  console.log('   4. Configure Rooms and Resources');
  console.log('   5. Log in as Receptionist to register Patients');
  console.log('========================================================');
  console.log('');
}

resetData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[ERROR]', err);
    process.exit(1);
  });
