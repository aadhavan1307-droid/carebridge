/**
 * CareBridge 2.0 — Development Demo Seed Script
 * ===============================================
 * npm run db:legacy-seed
 *
 * This script is ONLY for development demo data.
 * It MUST NEVER be called automatically from server startup.
 *
 * Use npm run db:reset-data to clean the database to a blank state.
 * Use npm run db:populate to populate the current synthetic dataset.
 */

import { initDatabase, run, get, all, transaction } from './db.js';
import { hashPassword } from '../auth.js';

export async function seedDatabase() {
  console.log('');
  console.log('[SEED] CareBridge 2.0 — Demo Data Seed (Development Only)');
  console.log('[SEED] This should NEVER run automatically on server start.');
  console.log('');

  await initDatabase();

  await transaction(async () => {
    // Clear only operational data — NOT schema
    await run('DELETE FROM discharges');
    await run('DELETE FROM discharge_requests');
    await run('DELETE FROM clinical_risk_assessments');
    await run('DELETE FROM resource_allocations');
    await run('DELETE FROM assignments');
    await run('DELETE FROM care_team_assignments');
    await run('DELETE FROM patient_requirements');
    await run('DELETE FROM ai_decisions');
    await run('DELETE FROM conflicts');
    await run('DELETE FROM audit_logs');
    await run('DELETE FROM observation_history');
    await run('DELETE FROM risk_history');
    await run('DELETE FROM priority_history');
    await run('DELETE FROM encounters');
    await run('DELETE FROM patients');
    await run('DELETE FROM doctors');
    await run("DELETE FROM users WHERE role = 'DOCTOR'");
    await run("DELETE FROM users WHERE role IN ('ADMINISTRATOR','RECEPTIONIST')");
    await run('DELETE FROM rooms');
    await run('DELETE FROM resources');
    await run('DELETE FROM system_settings');

    // System Accounts
    await run(
      `INSERT INTO users (id, username, email, password_hash, name, role, specialty, doctor_id, token_version, status)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 1, 'ACTIVE')`,
      ['USR-ADM-01', 'admin', 'admin@carebridge.local', hashPassword('Admin@2026!'), 'System Administrator', 'ADMINISTRATOR']
    );
    await run(
      `INSERT INTO users (id, username, email, password_hash, name, role, specialty, doctor_id, token_version, status)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 1, 'ACTIVE')`,
      ['USR-REC-01', 'reception', 'reception@carebridge.local', hashPassword('Reception@2026!'), 'Reception Desk', 'RECEPTIONIST']
    );

    // Demo Doctor Accounts
    const docUsers = [
      { id: 'USR-DOC-01', username: 'sarah.lin',     email: 'sarah.lin@carebridge.local',     pass: 'doctor123', name: 'Dr. Sarah Lin',     specialty: 'CARDIOLOGY',  docId: 'DOC-101' },
      { id: 'USR-DOC-02', username: 'james.chen',    email: 'james.chen@carebridge.local',    pass: 'Doctor@2026!', name: 'Dr. James Chen',    specialty: 'TRAUMA',      docId: 'DOC-104' },
      { id: 'USR-DOC-03', username: 'elena.rostova', email: 'elena.rostova@carebridge.local', pass: 'Doctor@2026!', name: 'Dr. Elena Rostova', specialty: 'TRAUMA',      docId: 'DOC-103' },
      { id: 'USR-DOC-04', username: 'aris.thorne',   email: 'aris.thorne@carebridge.local',   pass: 'Doctor@2026!', name: 'Dr. Aris Thorne',   specialty: 'NEUROLOGY',   docId: 'DOC-105' },
      { id: 'USR-DOC-05', username: 'marcus.vance',  email: 'marcus.vance@carebridge.local',  pass: 'Doctor@2026!', name: 'Dr. Marcus Vance',  specialty: 'CARDIOLOGY',  docId: 'DOC-102' },
    ];
    for (const u of docUsers) {
      await run(
        `INSERT INTO users (id, username, email, password_hash, name, role, specialty, doctor_id, token_version, status)
         VALUES (?, ?, ?, ?, ?, 'DOCTOR', ?, ?, 1, 'ACTIVE')`,
        [u.id, u.username, u.email, hashPassword(u.pass), u.name, u.specialty, u.docId]
      );
    }

    // Demo Doctors
    const doctors = [
      { id: 'DOC-101', userId: 'USR-DOC-01', name: 'Dr. Sarah Lin',     specialty: 'CARDIOLOGY',  dept: 'Cardiology',              exp: 14, cap: 8, load: 0 },
      { id: 'DOC-102', userId: 'USR-DOC-05', name: 'Dr. Marcus Vance',  specialty: 'CARDIOLOGY',  dept: 'Cardiology',              exp: 18, cap: 8, load: 0 },
      { id: 'DOC-103', userId: 'USR-DOC-03', name: 'Dr. Elena Rostova', specialty: 'TRAUMA',      dept: 'Trauma & Acute Surgery',  exp: 12, cap: 8, load: 0 },
      { id: 'DOC-104', userId: 'USR-DOC-02', name: 'Dr. James Chen',    specialty: 'TRAUMA',      dept: 'Trauma & Acute Surgery',  exp: 9,  cap: 8, load: 0 },
      { id: 'DOC-105', userId: 'USR-DOC-04', name: 'Dr. Aris Thorne',   specialty: 'NEUROLOGY',   dept: 'Neurology & Neurosurgery', exp: 15, cap: 8, load: 0 },
    ];
    for (const d of doctors) {
      await run(
        `INSERT INTO doctors (id, user_id, name, specialty, department, experience_years, availability_status, current_load, max_capacity)
         VALUES (?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, ?)`,
        [d.id, d.userId, d.name, d.specialty, d.dept, d.exp, d.load, d.cap]
      );
    }

    // Demo Rooms (10 ICU, 10 Emergency Bays, 5 OR, 15 Ward)
    const roomDefs = [
      { prefix: 'ICU-',  type: 'ICU',           care: 'CRITICAL',  cap: 1, count: 10, equip: ['VENTILATOR','CARDIAC_MONITOR','INFUSION_PUMP'] },
      { prefix: 'BAY-',  type: 'EMERGENCY_BAY', care: 'HIGH',      cap: 1, count: 10, equip: ['CARDIAC_MONITOR','INFUSION_PUMP'] },
      { prefix: 'OR-',   type: 'OPERATING_ROOM',care: 'CRITICAL',  cap: 1, count: 5,  equip: ['VENTILATOR','CARDIAC_MONITOR'] },
      { prefix: 'WARD-', type: 'GENERAL_WARD',  care: 'MODERATE',  cap: 2, count: 15, equip: ['PULSE_OXIMETER'] },
    ];
    let rIdx = 101;
    for (const rt of roomDefs) {
      for (let i = 1; i <= rt.count; i++) {
        const num = rt.prefix + (i < 10 ? '0' + i : i);
        await run(
          `INSERT INTO rooms (id, room_number, room_type, care_level, capacity, current_occupancy, status, equipment_json)
           VALUES (?, ?, ?, ?, ?, 0, 'AVAILABLE', ?)`,
          [`RM-${rIdx++}`, num, rt.type, rt.care, rt.cap, JSON.stringify(rt.equip)]
        );
      }
    }

    // Demo Resources
    const resources = [
      { id: 'RES-VENT',  name: 'Mechanical Ventilators',           type: 'VENTILATOR',     total: 15, alloc: 0 },
      { id: 'RES-MON',   name: 'Multi-parameter Cardiac Monitors', type: 'CARDIAC_MONITOR',total: 35, alloc: 0 },
      { id: 'RES-DEFIB', name: 'Biphasic Defibrillators',          type: 'DEFIBRILLATOR',  total: 10, alloc: 0 },
      { id: 'RES-PUMP',  name: 'Smart Infusion Pumps',             type: 'INFUSION_PUMP',  total: 40, alloc: 0 },
      { id: 'RES-XRAY',  name: 'Portable Digital X-Ray Machines',  type: 'PORTABLE_XRAY',  total: 6,  alloc: 0 },
    ];
    for (const res of resources) {
      await run(
        `INSERT INTO resources (id, name, resource_type, total_count, allocated_count, status)
         VALUES (?, ?, ?, ?, ?, 'OPERATIONAL')`,
        [res.id, res.name, res.type, res.total, res.alloc]
      );
    }

    // Demo Patient PAT-1001 for test suite & continuous reassessment verification
    await run(
      `INSERT INTO patients (id, name, age, gender, emergency_category, clinical_risk_level, system_calculated_risk, operational_priority_level, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['PAT-1001', 'Demo Patient 1001', 55, 'MALE', 'CARDIAC', 'HIGH', 'HIGH', 'P1', 'ADMITTED']
    );
    await run(
      `INSERT INTO encounters (id, patient_id, status, admission_notes)
       VALUES (?, ?, ?, ?)`,
      ['ENC-1001', 'PAT-1001', 'ADMITTED', 'Severe chest pain']
    );
    await run(
      `INSERT INTO observation_history (id, patient_id, encounter_id, observation_type, value, unit, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['OBS-1001-1', 'PAT-1001', 'ENC-1001', 'SPO2', '88', '%', 'Initial Triage']
    );
    await run(
      `INSERT INTO risk_history (id, patient_id, previous_risk, new_risk, contributing_factors_json)
       VALUES (?, ?, ?, ?, ?)`,
      ['RSK-1001-1', 'PAT-1001', 'NOT_ASSESSED', 'HIGH', JSON.stringify(['Initial Triage Risk Assessment'])]
    );

    // Demo Patient PAT-1002 for Test 11 doctor risk assessment workflow
    await run(
      `INSERT INTO patients (id, name, age, gender, emergency_category, clinical_risk_level, system_calculated_risk, operational_priority_level, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['PAT-1002', 'Demo Patient 1002', 62, 'FEMALE', 'CARDIAC', 'CRITICAL', 'CRITICAL', 'P1', 'ADMITTED']
    );
    await run(
      `INSERT INTO encounters (id, patient_id, status, admission_notes)
       VALUES (?, ?, ?, ?)`,
      ['ENC-PAT-1002', 'PAT-1002', 'ADMITTED', 'Cardiac emergency']
    );
    await run(
      `INSERT INTO observation_history (id, patient_id, encounter_id, observation_type, value, unit, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['OBS-1002-1', 'PAT-1002', 'ENC-PAT-1002', 'SPO2', '85', '%', 'Initial Triage']
    );
    await run(
      `INSERT INTO risk_history (id, patient_id, previous_risk, new_risk, contributing_factors_json)
       VALUES (?, ?, ?, ?, ?)`,
      ['RSK-1002-1', 'PAT-1002', 'NOT_ASSESSED', 'CRITICAL', JSON.stringify(['Initial Triage Assessment'])]
    );

    // System settings
    await run(
      `INSERT INTO system_settings (key, value_json) VALUES ('config', ?)`,
      [JSON.stringify({ ai_algorithm_default: 'A_STAR', human_oversight_required: true })]
    );

    // Audit log
    await run(
      `INSERT INTO audit_logs (id, event_type, actor_role, payload_json)
       VALUES ('AUD-SEED-001', 'SYSTEM_DEMO_SEEDED', 'SYSTEM', ?)`,
      [JSON.stringify({ message: 'Development demo seed executed (manual command only).' })]
    );
  });

  console.log('[SEED] Demo seed complete.');
  console.log('');
  console.log('[SEED] Accounts seeded:');
  console.log('   admin@carebridge.local         / Admin@2026!');
  console.log('   reception@carebridge.local     / Reception@2026!');
  console.log('   sarah.lin@carebridge.local     / Doctor@2026!');
  console.log('   james.chen@carebridge.local    / Doctor@2026!');
  console.log('   elena.rostova@carebridge.local / Doctor@2026!');
  console.log('   aris.thorne@carebridge.local   / Doctor@2026!');
  console.log('   marcus.vance@carebridge.local  / Doctor@2026!');
  console.log('');
}

// Only run directly when called as the explicitly named legacy fixture command.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('database/seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[SEED ERROR]', err);
      process.exit(1);
    });
}
