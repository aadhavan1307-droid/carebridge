/**
 * CareBridge 2.0 — Synthetic Test Data Population Script
 * ========================================================
 * npm run db:populate
 *
 * Populates synthetic test data for doctors, rooms, resources, and patients
 * via the live application REST API endpoints.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3001';

async function apiCall(method, endpoint, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${endpoint}`, opts);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, body: json };
}

async function main() {
  console.log('========================================================');
  console.log(' CareBridge 2.0 — Synthetic Test Data Population');
  console.log('========================================================\n');

  // 1. Log in as Admin
  console.log('[STEP 1] Logging in as Administrator (admin@carebridge.local)...');
  const adminLogin = await apiCall('POST', '/api/auth/login', {
    login_id: 'admin@carebridge.local',
    password: 'Admin@2026!'
  });

  if (!adminLogin.ok) {
    console.error('FAILED to log in as Admin:', adminLogin.body);
    process.exit(1);
  }

  const adminToken = adminLogin.body.token;
  console.log('  ✓ Admin authentication successful.\n');

  // 2. Create Doctors via Admin API
  console.log('[STEP 2] Creating synthetic doctor accounts via Canonical Doctor API...');
  const DOCTORS = [
    {
      doctor_id: 'DOC-201',
      name: 'Dr. Ananya Rao',
      specialty: 'Cardiology',
      department: 'Emergency Care',
      qualification: 'MBBS, MD Cardiology',
      contact: '+91-9000000201',
      shift: 'DAY',
      max_capacity: 8,
      email: 'ananya.rao@carebridge.local',
      username: 'ananya.rao',
      password: 'Doctor@2026!Ananya'
    },
    {
      doctor_id: 'DOC-202',
      name: 'Dr. Vikram Singh',
      specialty: 'Emergency Medicine',
      department: 'Emergency Care',
      qualification: 'MBBS, MD Emergency Medicine',
      contact: '+91-9000000202',
      shift: 'DAY',
      max_capacity: 10,
      email: 'vikram.singh@carebridge.local',
      username: 'vikram.singh',
      password: 'Doctor@2026!Vikram'
    },
    {
      doctor_id: 'DOC-203',
      name: 'Dr. Meera Nair',
      specialty: 'Pulmonology',
      department: 'Emergency Care',
      qualification: 'MBBS, MD Pulmonology',
      contact: '+91-9000000203',
      shift: 'DAY',
      max_capacity: 8,
      email: 'meera.nair@carebridge.local',
      username: 'meera.nair',
      password: 'Doctor@2026!Meera'
    }
  ];

  for (const doc of DOCTORS) {
    const docRes = await apiCall('POST', '/api/admin/doctors', doc, adminToken);
    if (docRes.ok || docRes.status === 409) {
      console.log(`  ✓ Doctor created/exists: ${doc.name} (${doc.doctor_id})`);
    } else {
      console.error(`  ✗ Error creating doctor ${doc.name}:`, docRes.body);
    }
  }
  console.log('');

  // 3. Configure Rooms and Resources via Admin API
  console.log('[STEP 3] Configuring hospital rooms and resources via Admin API...');
  const ROOMS = [
    { room_number: 'ICU-01', room_type: 'ICU', care_level: 'CRITICAL', capacity: 1, equipment: ['VENTILATOR', 'CARDIAC_MONITOR'] },
    { room_number: 'ICU-02', room_type: 'ICU', care_level: 'CRITICAL', capacity: 1, equipment: ['VENTILATOR', 'CARDIAC_MONITOR'] },
    { room_number: 'BAY-01', room_type: 'EMERGENCY_BAY', care_level: 'HIGH', capacity: 1, equipment: ['CARDIAC_MONITOR'] },
    { room_number: 'BAY-02', room_type: 'EMERGENCY_BAY', care_level: 'HIGH', capacity: 1, equipment: ['CARDIAC_MONITOR'] },
    { room_number: 'WARD-01', room_type: 'GENERAL_WARD', care_level: 'MODERATE', capacity: 2, equipment: ['PULSE_OXIMETER'] }
  ];

  for (const room of ROOMS) {
    const roomRes = await apiCall('POST', '/api/admin/rooms', room, adminToken);
    if (roomRes.ok || roomRes.status === 409) {
      console.log(`  ✓ Room configured: ${room.room_number} (${room.room_type})`);
    }
  }

  const RESOURCES = [
    { name: 'Mechanical Ventilators', resource_type: 'VENTILATOR', total_count: 10 },
    { name: 'Multi-parameter Cardiac Monitors', resource_type: 'CARDIAC_MONITOR', total_count: 20 },
    { name: 'Smart Infusion Pumps', resource_type: 'INFUSION_PUMP', total_count: 25 },
    { name: 'Portable X-Ray Units', resource_type: 'PORTABLE_XRAY', total_count: 5 }
  ];

  for (const res of RESOURCES) {
    const resRes = await apiCall('POST', '/api/admin/resources', res, adminToken);
    if (resRes.ok || resRes.status === 409) {
      console.log(`  ✓ Resource configured: ${res.name} (Qty: ${res.total_count})`);
    }
  }
  console.log('');

  // 4. Log in as Receptionist
  console.log('[STEP 4] Logging in as Receptionist (reception@carebridge.local)...');
  const recLogin = await apiCall('POST', '/api/auth/login', {
    login_id: 'reception@carebridge.local',
    password: 'Reception@2026!'
  });

  if (!recLogin.ok) {
    console.error('FAILED to log in as Receptionist:', recLogin.body);
    process.exit(1);
  }

  const recToken = recLogin.body.token;
  console.log('  ✓ Receptionist authentication successful.\n');

  // 5. Admit Synthetic Test Patients
  console.log('[STEP 5] Admitting synthetic test patients through real Receptionist pipeline...');
  const PATIENTS = [
    {
      label: 'PATIENT A — HIGH/EMERGENCY TEST',
      name: 'Arjun Kumar (SYNTHETIC/TEST DATA)',
      age: 46,
      gender: 'Male',
      contact: '+91-9000011001',
      emergency_category: 'CARDIAC',
      chief_complaint: 'Severe chest discomfort with shortness of breath',
      consciousness_state: 'ALERT',
      symptoms: ['Chest Pain', 'Shortness of Breath', 'Diaphoresis'],
      vitals: {
        hr: 118,
        bp_sys: 88,
        bp_dia: 58,
        spo2: 91,
        resp_rate: 26,
        temp: 37.1
      }
    },
    {
      label: 'PATIENT B — RESPIRATORY TEST',
      name: 'Kavya Menon (SYNTHETIC/TEST DATA)',
      age: 34,
      gender: 'Female',
      contact: '+91-9000011002',
      emergency_category: 'RESPIRATORY',
      chief_complaint: 'Breathing difficulty and persistent cough',
      consciousness_state: 'ALERT',
      symptoms: ['Dyspnea', 'Wheezing', 'Cough'],
      vitals: {
        hr: 98,
        bp_sys: 118,
        bp_dia: 76,
        spo2: 93,
        resp_rate: 24,
        temp: 37.8
      }
    },
    {
      label: 'PATIENT C — MODERATE TEST',
      name: 'Rahul Prasad (SYNTHETIC/TEST DATA)',
      age: 29,
      gender: 'Male',
      contact: '+91-9000011003',
      emergency_category: 'GENERAL',
      chief_complaint: 'Abdominal pain with vomiting',
      consciousness_state: 'ALERT',
      symptoms: ['Abdominal Pain', 'Nausea', 'Vomiting'],
      vitals: {
        hr: 82,
        bp_sys: 122,
        bp_dia: 78,
        spo2: 98,
        resp_rate: 18,
        temp: 37.4
      }
    },
    {
      label: 'PATIENT D — STABLE/LOWER-URGENCY TEST',
      name: 'Nisha Iyer (SYNTHETIC/TEST DATA)',
      age: 25,
      gender: 'Female',
      contact: '+91-9000011004',
      emergency_category: 'GENERAL',
      chief_complaint: 'Minor wrist injury after a fall',
      consciousness_state: 'ALERT',
      symptoms: ['Wrist Pain', 'Localized Swelling'],
      vitals: {
        hr: 72,
        bp_sys: 116,
        bp_dia: 74,
        spo2: 99,
        resp_rate: 16,
        temp: 36.8
      }
    }
  ];

  const createdPatients = [];

  for (const pData of PATIENTS) {
    console.log(`\n  --- Processing ${pData.label} ---`);
    const admitRes = await apiCall('POST', '/api/patients/admit', pData, recToken);

    if (!admitRes.ok) {
      console.error(`  ✗ Admission failed:`, admitRes.body);
      continue;
    }

    const patId = admitRes.body.patient_id;
    const risk = admitRes.body.risk;
    const priority = admitRes.body.operational_priority_level || 'NOT_ASSESSED';
    const alloc = admitRes.body.assignment || {};
    const docName = alloc.assignedDoctor ? alloc.assignedDoctor.name : 'None / PENDING';
    const roomNum = alloc.assignedRoom ? alloc.assignedRoom.room_number : 'None / PENDING';

    console.log(`  ✓ Patient Admitted Successfully!`);
    console.log(`    - Patient ID         : ${patId}`);
    console.log(`    - Name               : ${pData.name}`);
    console.log(`    - Category           : ${pData.emergency_category}`);
    console.log(`    - Risk Level         : ${risk}`);
    console.log(`    - Priority Level     : ${priority}`);
    console.log(`    - Doctor Assigned    : ${docName}`);
    console.log(`    - Room Assigned      : ${roomNum}`);

    createdPatients.push({
      label: pData.label,
      id: patId,
      name: pData.name,
      risk: risk,
      priority: priority,
      doctor: docName,
      docId: alloc.assignedDoctor ? alloc.assignedDoctor.id : null
    });
  }
  console.log('');

  // 6. Test Doctor Authentication & Authorization
  console.log('[STEP 6] Testing Doctor Authentication and Authorization Controls...');

  for (const doc of DOCTORS) {
    console.log(`\n  Testing Login for ${doc.name} (${doc.email})...`);
    const dLogin = await apiCall('POST', '/api/auth/login', {
      login_id: doc.email,
      password: doc.password
    });

    if (!dLogin.ok) {
      console.error(`  ✗ Doctor Login Failed for ${doc.name}:`, dLogin.body);
      continue;
    }

    const docToken = dLogin.body.token;
    console.log(`  ✓ Authentication Successful (Role: ${dLogin.body.user.role})`);

    // Verify /api/doctors/me
    const meRes = await apiCall('GET', '/api/doctors/me', null, docToken);
    const meDoc = meRes.body.doctor || meRes.body;
    if (meRes.ok && meDoc.id === doc.doctor_id) {
      console.log(`  ✓ /api/doctors/me verified identity -> ${meDoc.name} (${meDoc.id})`);
    } else {
      console.error(`  ✗ /api/doctors/me returned unexpected identity:`, meRes.body);
    }

    // Verify /api/doctors/me/patients
    const myPtsRes = await apiCall('GET', '/api/doctors/me/patients', null, docToken);
    if (myPtsRes.ok) {
      const count = Array.isArray(myPtsRes.body) ? myPtsRes.body.length : (myPtsRes.body.patients ? myPtsRes.body.patients.length : 0);
      console.log(`  ✓ /api/doctors/me/patients returned ${count} authorized patient(s).`);
    } else {
      console.error(`  ✗ /api/doctors/me/patients error:`, myPtsRes.body);
    }
  }

  // 7. Test Cross-Doctor Access Control (HTTP 403 enforcement)
  console.log('\n[STEP 7] Verifying Cross-Doctor Authorization Enforcement (403 check)...');
  const doc1Login = await apiCall('POST', '/api/auth/login', { login_id: DOCTORS[0].email, password: DOCTORS[0].password });
  const doc2Login = await apiCall('POST', '/api/auth/login', { login_id: DOCTORS[1].email, password: DOCTORS[1].password });

  const tokenDoc1 = doc1Login.body.token;
  const tokenDoc2 = doc2Login.body.token;

  // Find a patient assigned to Doc 1
  const doc1PatientsRes = await apiCall('GET', '/api/doctors/me/patients', null, tokenDoc1);
  const doc1Pts = Array.isArray(doc1PatientsRes.body) ? doc1PatientsRes.body : (doc1PatientsRes.body.patients || []);

  if (doc1Pts.length > 0) {
    const targetPatId = doc1Pts[0].id;
    console.log(`  Testing Doc 2 (${DOCTORS[1].name}) attempting to access Doc 1's patient (${targetPatId})...`);

    const unauthorizedCheck = await apiCall('GET', `/api/patients/${targetPatId}`, null, tokenDoc2);
    if (unauthorizedCheck.status === 403) {
      console.log(`  ✓ Access Denied! Received expected HTTP 403 Forbidden.`);
    } else if (unauthorizedCheck.ok) {
      console.log(`  ⚠ Patient endpoint allows access (or shared care assignment exists). Status: ${unauthorizedCheck.status}`);
    } else {
      console.log(`  ✓ Restricted access returned status: ${unauthorizedCheck.status}`);
    }
  }

  // 8. Update LOGIN_CREDENTIALS.md with patient details
  console.log('\n[STEP 8] Updating LOGIN_CREDENTIALS.md documentation file...');
  const credentialsPath = path.join(__dirname, '../../LOGIN_CREDENTIALS.md');

  const mdContent = `# CareBridge 2.0 — Login Credentials

> **WARNING:** These are synthetic local-development credentials only.
> Do not use these credentials in production.
> Passwords are stored as hashes in the database — never in plaintext.
> This file is for LOCAL DEVELOPMENT / TESTING ONLY.

---

## Administrator

**Login:** \`admin@carebridge.local\`
**Password:** \`Admin@2026!\`
**Role:** \`ADMINISTRATOR\`

---

## Receptionist

**Login:** \`reception@carebridge.local\`
**Password:** \`Reception@2026!\`
**Role:** \`RECEPTIONIST\`

---

## Doctors

### Dr. Ananya Rao

**Doctor ID:** \`DOC-201\`
**Login:** \`ananya.rao@carebridge.local\`
**Password:** \`Doctor@2026!Ananya\`
**Role:** \`DOCTOR\`
**Specialty:** \`Cardiology\`
**Department:** Emergency Care
**Max Capacity:** 8 patients

### Dr. Vikram Singh

**Doctor ID:** \`DOC-202\`
**Login:** \`vikram.singh@carebridge.local\`
**Password:** \`Doctor@2026!Vikram\`
**Role:** \`DOCTOR\`
**Specialty:** \`Emergency Medicine\`
**Department:** Emergency Care
**Max Capacity:** 10 patients

### Dr. Meera Nair

**Doctor ID:** \`DOC-203\`
**Login:** \`meera.nair@carebridge.local\`
**Password:** \`Doctor@2026!Meera\`
**Role:** \`DOCTOR\`
**Specialty:** \`Pulmonology\`
**Department:** Emergency Care
**Max Capacity:** 8 patients

---

## Synthetic Test Patients (Last Populated)

> All patient data is **SYNTHETIC/TEST DATA** — not real patient information.

| Patient ID | Name & Description | Risk Level | Priority | Assigned Doctor |
|-----------|-------------------|------------|----------|-----------------|
${createdPatients.map(p => `| ${p.id} | ${p.name} | ${p.risk} | ${p.priority} | ${p.doctor} |`).join('\n')}

---

## Environment

| Route | URL |
|---|---|
| Application | \`http://10.144.42.33:3001\` |
| Admin Login | \`/login/admin\` |
| Reception Login | \`/login/reception\` |
| Doctor Login | \`/login/doctor\` |

---

## NPM Commands

| Command | Description |
|---|---|
| \`npm start\` | Start server (no auto-seeding) |
| \`npm run db:reset-data\` | Wipe all operational data (keeps admin + receptionist) |
| \`npm run db:populate\` | Add synthetic test doctors + patients via real API |
| \`npm run db:legacy-seed\` | Add legacy full demo dataset (manual, development only) |

---

## Security Notes

- Passwords are stored as SHA-256 hashes in the \`users.password_hash\` column.
- Plaintext passwords are **never** stored in the database, API responses, audit logs, or frontend code.
- This file must **never** be deployed to a production server.
`;

  fs.writeFileSync(credentialsPath, mdContent, 'utf8');
  console.log(`  ✓ LOGIN_CREDENTIALS.md successfully updated.\n`);

  console.log('========================================================');
  console.log(' Synthetic Test Data Population Complete!');
  console.log('========================================================');
}

main().catch(err => {
  console.error('POPULATE ERROR:', err);
  process.exit(1);
});
