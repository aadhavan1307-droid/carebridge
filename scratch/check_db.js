import { all } from '../backend/database/db.js';

async function check() {
  const patients = await all('SELECT id, name FROM patients');
  const doctors = await all('SELECT id, name FROM doctors');
  const rooms = await all('SELECT id, room_number FROM rooms');
  const demoAudits = await all('SELECT * FROM audit_logs WHERE event_type = "SYSTEM_DEMO_SEEDED"');

  console.log('=== OPERATIONAL DB RECORD CHECK ===');
  console.log('Total Patients:', patients.length);
  console.log('Patient Records:', patients);
  console.log('Total Doctors:', doctors.length);
  console.log('Doctor Records:', doctors);
  console.log('Total Rooms:', rooms.length);
  console.log('SYSTEM_DEMO_SEEDED Logs:', demoAudits.length);
}

check().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
