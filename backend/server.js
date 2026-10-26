
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { run, get, all, initDatabase, transaction } from './database/db.js';
import { hashPassword, verifyPassword, generateToken, authenticateToken, requireRole } from './auth.js';
import { calculatePriority, reconcileRiskAndPriority } from './ai/priorityEngine.js';
import { deriveRequirements } from './ai/requirementEngine.js';
import { evaluateCSPConstraints, scoreCandidatePair } from './ai/cspEngine.js';
import { runAStarPlanner } from './ai/astarEngine.js';
import { evaluateDynamicReplanning } from './ai/replanningEngine.js';
import { predictPatientRisk, runMLModelComparison } from './ai/mlEngine.js';
import { runAlgorithmBenchmark } from './ai/benchmarkEngine.js';
import { runSimulationScenario } from './ai/simulationEngine.js';
import { processClinicalObservations, validateObservationPayload } from './ai/observationEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_PATH = path.join(__dirname, '../dist');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
}

// Server-Sent Events (SSE) subscribers
const sseClients = new Set();

function broadcastEvent(eventType, payload) {
  const data = JSON.stringify({ eventType, payload, timestamp: new Date().toISOString() });
  for (const client of sseClients) {
    client.write(`data: ${data}\n\n`);
  }
}

// Helper: Insert Audit Event Record in DB
async function insertAuditLog(eventType, actorRole = 'SYSTEM', payload = {}, actorId = null) {
  const id = `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await run(
    `INSERT INTO audit_logs (id, event_type, actor_role, actor_id, payload_json) VALUES (?, ?, ?, ?, ?)`,
    [id, eventType, actorRole, actorId, JSON.stringify(payload)]
  );
  return { id, eventType, actorRole, payload };
}

// Helper: Log Audit Event (Insert DB + Broadcast SSE when called outside transaction)
async function logAuditEvent(eventType, actorRole = 'SYSTEM', payload = {}, actorId = null) {
  const audit = await insertAuditLog(eventType, actorRole, payload, actorId);
  broadcastEvent('AUDIT_LOG_ADDED', audit);
  return audit;
}

// Helper: Doctor Patient Authorization Check
async function canDoctorAccessPatient(doctorId, patientId) {
  if (!doctorId || !patientId) return false;
  const patient = await get('SELECT assigned_doctor_id FROM patients WHERE id = ?', [patientId]);
  if (!patient) return false;

  if (patient.assigned_doctor_id === doctorId) return true;

  const docRecord = await get('SELECT id, user_id FROM doctors WHERE id = ? OR user_id = ?', [doctorId, doctorId]);
  if (docRecord && (patient.assigned_doctor_id === docRecord.id || patient.assigned_doctor_id === docRecord.user_id)) {
    return true;
  }

  const careTeam = await get(
    'SELECT 1 FROM care_team_assignments WHERE patient_id = ? AND (doctor_id = ? OR doctor_id = ?) AND status = "ACTIVE"',
    [patientId, doctorId, docRecord ? docRecord.id : doctorId]
  );
  return Boolean(careTeam);
}

// ----------------------------------------------------
// 1. AUTHENTICATION ENDPOINTS
// ----------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  try {
    const identifier = (req.body.email || req.body.login_id || req.body.username || req.body.identifier || '').toString().toLowerCase().trim();
    const password = req.body.password;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Doctor ID / Email / Username and password are required.' });
    }

    const user = await get(`
      SELECT u.*, d.id as linked_doctor_id, d.name as doctor_name, d.specialty as doctor_specialty 
      FROM users u 
      LEFT JOIN doctors d ON u.doctor_id = d.id OR u.id = d.user_id
      WHERE LOWER(u.email) = ? OR LOWER(u.username) = ? OR LOWER(u.id) = ? OR LOWER(u.doctor_id) = ? OR LOWER(d.id) = ?
    `, [identifier, identifier, identifier, identifier, identifier]);

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials. Please check Doctor ID / Email / Username and password.' });
    }

    if (user.status === 'INACTIVE') {
      return res.status(403).json({ error: 'Account is disabled/inactive. Please contact an administrator.' });
    }

    await run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    const doctorId = user.doctor_id || user.linked_doctor_id || null;
    const tokenUser = { ...user, doctor_id: doctorId };
    const token = generateToken(tokenUser);

    await logAuditEvent('USER_LOGIN', user.role, { userId: user.id, email: user.email, doctor_id: doctorId }, user.id);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        specialty: user.specialty,
        doctor_id: doctorId
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    await run('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [req.user.id]);
    await logAuditEvent('USER_LOGOUT', req.user.role, { userId: req.user.id }, req.user.id);
    res.json({ success: true, message: 'Successfully logged out and session invalidated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ----------------------------------------------------
// 2. DASHBOARD & SYSTEM METRICS
// ----------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', system: 'CareBridge 2.0 Master Production Build Architecture', timestamp: new Date() });
});

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const totalPatientsRow = await get(`SELECT COUNT(*) as count FROM patients WHERE status != 'DISCHARGED'`);
    const criticalRow = await get(`SELECT COUNT(*) as count FROM patients WHERE clinical_risk_level = 'CRITICAL' AND status != 'DISCHARGED'`);
    const highRow = await get(`SELECT COUNT(*) as count FROM patients WHERE clinical_risk_level = 'HIGH' AND status != 'DISCHARGED'`);
    const moderateRow = await get(`SELECT COUNT(*) as count FROM patients WHERE clinical_risk_level = 'MODERATE' AND status != 'DISCHARGED'`);
    const lowRow = await get(`SELECT COUNT(*) as count FROM patients WHERE clinical_risk_level = 'LOW' AND status != 'DISCHARGED'`);
    const unallocatedRow = await get(`SELECT COUNT(*) as count FROM patients WHERE (status IN ('ADMITTED', 'TRIAGED') OR assigned_doctor_id IS NULL OR assigned_room_id IS NULL) AND status != 'DISCHARGED'`);
    const dischargedRow = await get(`SELECT COUNT(*) as count FROM discharges`);

    const totalBedsRow = await get(`SELECT COALESCE(SUM(capacity), 0) as count FROM rooms`);
    const occupiedBedsRow = await get(`SELECT COALESCE(SUM(current_occupancy), 0) as count FROM rooms`);
    const availableBedsRow = await get(`SELECT COALESCE(SUM(CASE WHEN current_occupancy < capacity THEN (capacity - current_occupancy) ELSE 0 END), 0) as count FROM rooms WHERE status = 'AVAILABLE'`);
    const totalRoomsRow = await get(`SELECT COUNT(*) as count FROM rooms`);
    const availableRoomsRow = await get(`SELECT COUNT(*) as count FROM rooms WHERE status = 'AVAILABLE'`);
    const occupiedRoomsRow = await get(`SELECT COUNT(*) as count FROM rooms WHERE status = 'OCCUPIED'`);

    const icuTotalRow = await get(`SELECT COALESCE(SUM(capacity), 0) as count FROM rooms WHERE room_type = 'ICU'`);
    const icuOccupiedRow = await get(`SELECT COALESCE(SUM(current_occupancy), 0) as count FROM rooms WHERE room_type = 'ICU'`);
    const icuAvailableRow = await get(`SELECT COALESCE(SUM(CASE WHEN current_occupancy < capacity THEN (capacity - current_occupancy) ELSE 0 END), 0) as count FROM rooms WHERE room_type = 'ICU' AND status = 'AVAILABLE'`);
    const icuConfigured = icuTotalRow.count > 0;

    const totalDocsRow = await get(`SELECT COUNT(*) as count FROM doctors`);
    const availableDocsRow = await get(`SELECT COUNT(*) as count FROM doctors WHERE availability_status = 'AVAILABLE'`);
    const atCapacityDocsRow = await get(`SELECT COUNT(*) as count FROM doctors WHERE current_load >= max_capacity OR availability_status = 'BUSY'`);

    const resourceSumRow = await get(`SELECT COALESCE(SUM(total_count), 0) as total, COALESCE(SUM(allocated_count), 0) as allocated FROM resources WHERE status != 'MAINTENANCE'`);
    const totalRes = resourceSumRow.total || 0;
    const allocatedRes = resourceSumRow.allocated || 0;
    const availableRes = Math.max(0, totalRes - allocatedRes);
    const resourceUtilizationPct = totalRes > 0 ? Math.round((allocatedRes / totalRes) * 100) : 0;

    const totalDecisionsRow = await get(`SELECT COUNT(*) as count FROM ai_decisions`);
    const activeConflictsRow = await get(`SELECT COUNT(*) as count FROM conflicts WHERE status = 'ACTIVE'`);
    const pendingDischargesRow = await get(`SELECT COUNT(*) as count FROM discharge_requests WHERE status = 'PENDING'`);
    const dischargeRequestedRow = await get(`SELECT COUNT(*) as count FROM patients WHERE status = 'DISCHARGE_REQUESTED'`);

    const totalBeds = totalBedsRow.count || 0;
    const occupiedBeds = occupiedBedsRow.count || 0;
    const bedOccupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    res.json({
      patients: {
        total_active: totalPatientsRow.count,
        critical: criticalRow.count,
        high: highRow.count,
        moderate: moderateRow.count,
        low: lowRow.count,
        awaiting_assignment: unallocatedRow.count,
        unallocated: unallocatedRow.count,
        recently_discharged: dischargedRow.count
      },
      rooms: {
        total_rooms: totalRoomsRow.count,
        available_rooms: availableRoomsRow.count,
        occupied_rooms: occupiedRoomsRow.count,
        total_beds: totalBeds,
        available_beds: availableBedsRow.count,
        occupied_beds: occupiedBeds,
        occupancy_pct: bedOccupancyPct,
        icu: {
          configured: icuConfigured,
          total_beds: icuTotalRow.count,
          available_beds: icuAvailableRow.count,
          occupied_beds: icuOccupiedRow.count,
          formatted: icuConfigured ? `${icuAvailableRow.count} / ${icuTotalRow.count}` : 'NOT CONFIGURED'
        }
      },
      staff: {
        total: totalDocsRow.count,
        available: availableDocsRow.count,
        busy: atCapacityDocsRow.count,
        at_capacity: atCapacityDocsRow.count
      },
      resources: {
        total: totalRes,
        allocated: allocatedRes,
        available: availableRes,
        utilization_pct: resourceUtilizationPct
      },
      ai: {
        total_decisions: totalDecisionsRow.count,
        active_conflicts: activeConflictsRow.count
      },
      discharge_workflow: {
        pending_requests: pendingDischargesRow.count,
        patients_awaiting_discharge: dischargeRequestedRow.count
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 3. PATIENT INTAKE & RECEPTIONIST WORKSPACE
// ----------------------------------------------------
app.post('/api/patients/admit', authenticateToken, requireRole('RECEPTIONIST', 'ADMIN'), async (req, res) => {
  try {
    const {
      name,
      age,
      gender,
      contact = 'N/A',
      emergency_category = 'GENERAL',
      consciousness_state = 'ALERT',
      symptoms = [],
      known_conditions = [],
      vitals = {},
      auto_assign = true
    } = req.body;

    if (!name || !age || !gender) {
      return res.status(400).json({ error: 'Patient name, age, and gender are required.' });
    }

    const patientId = `PAT-${Date.now().toString().slice(-6)}`;
    const encounterId = `ENC-${patientId}`;

    // Priority & Risk
    const priorityResult = calculatePriority({ emergency_category, consciousness_state, symptoms, vitals });
    const operationalPriorityLevel = priorityResult.priority_level;
    let riskLevel = 'LOW';
    if (operationalPriorityLevel === 'P1') riskLevel = 'CRITICAL';
    else if (operationalPriorityLevel === 'P2') riskLevel = 'HIGH';
    else if (operationalPriorityLevel === 'P3') riskLevel = 'MODERATE';

    const requirements = deriveRequirements({ emergency_category, symptoms }, priorityResult);

    let assignmentResult = null;
    let admissionStatus = auto_assign ? 'ALLOCATION_PENDING' : 'TRIAGED';
    let allocationFailureReason = null;
    let auditLogRecord = null;

    await transaction(async () => {
      // Insert Patient
      await run(
        `INSERT INTO patients (id, name, age, gender, contact, emergency_category, consciousness_state, clinical_risk_level, operational_priority_level, priority_score, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [patientId, name, age, gender, contact, emergency_category, consciousness_state, riskLevel, operationalPriorityLevel, priorityResult.priority_score, admissionStatus]
      );

      // Insert Encounter
      await run(`INSERT INTO encounters (id, patient_id, status) VALUES (?, ?, 'ADMITTED')`, [encounterId, patientId]);

      // Record Initial Observations
      for (const [k, v] of Object.entries(vitals)) {
        await run(
          `INSERT INTO observation_history (id, patient_id, encounter_id, observation_type, value, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [`OBS-${Date.now()}-${k}`, patientId, encounterId, k.toUpperCase(), String(v), req.user.name]
        );
      }

      // Record Initial Risk & Priority History
      await run(
        `INSERT INTO risk_history (id, patient_id, previous_risk, new_risk, contributing_factors_json) VALUES (?, ?, 'NOT_ASSESSED', ?, ?)`,
        [`RSK-${Date.now()}`, patientId, riskLevel, JSON.stringify(priorityResult.contributing_factors)]
      );

      await run(
        `INSERT INTO priority_history (id, patient_id, previous_priority, new_priority, priority_score, reason) VALUES (?, ?, 'NOT_ASSESSED', ?, ?, ?)`,
        [`PRY-${Date.now()}`, patientId, operationalPriorityLevel, priorityResult.priority_score, priorityResult.explanation]
      );

      // Requirements
      await run(
        `INSERT INTO patient_requirements (id, patient_id, specialty, care_level, room_type, monitoring_level, required_equipment_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [`REQ-${patientId}`, patientId, requirements.specialty, requirements.care_level, requirements.room_type, requirements.monitoring_level, JSON.stringify(requirements.required_equipment)]
      );

      // Auto Assignment
      if (auto_assign) {
        const doctors = await all(`SELECT * FROM doctors`);
        const rooms = await all(`SELECT * FROM rooms`);
        const resources = await all(`SELECT * FROM resources`);

        const csp = evaluateCSPConstraints({ id: patientId, priority_level: operationalPriorityLevel }, requirements, doctors, rooms, resources);

        if (csp.status === 'FEASIBLE' && csp.valid_doctors.length > 0 && csp.valid_rooms.length > 0) {
          let bestPair = null;
          let bestScore = -1;

          for (const doc of csp.valid_doctors) {
            for (const room of csp.valid_rooms) {
              const pairScore = scoreCandidatePair({ priority_level: operationalPriorityLevel }, requirements, doc, room, doctors);
              if (pairScore > bestScore) {
                bestScore = pairScore;
                bestPair = { doctor: doc, room };
              }
            }
          }

          if (bestPair) {
            const assignedDoctor = bestPair.doctor;
            const assignedRoom = bestPair.room;

            const doctorUpdate = await run(
              `UPDATE doctors SET current_load = current_load + 1 WHERE id = ? AND availability_status NOT IN ('ON_LEAVE', 'UNAVAILABLE') AND current_load < max_capacity`,
              [assignedDoctor.id]
            );
            const roomUpdate = await run(
              `UPDATE rooms SET current_occupancy = current_occupancy + 1, status = CASE WHEN current_occupancy + 1 >= capacity THEN 'OCCUPIED' ELSE status END WHERE id = ? AND current_occupancy < capacity AND status != 'MAINTENANCE'`,
              [assignedRoom.id]
            );

            if (doctorUpdate.changes !== 1 || roomUpdate.changes !== 1) {
              throw new Error('Required doctor or room allocation became unavailable.');
            }

            const assignmentId = `ASN-${patientId}`;
            await run(
              `INSERT INTO assignments (id, patient_id, doctor_id, room_id, resources_allocated_json, status, score) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`,
              [assignmentId, patientId, assignedDoctor.id, assignedRoom.id, JSON.stringify(requirements.required_equipment), bestScore]
            );

            for (const reqEq of requirements.required_equipment) {
              const resource = await get(
                `SELECT * FROM resources WHERE resource_type = ? AND status != 'MAINTENANCE' AND allocated_count < total_count ORDER BY id LIMIT 1`,
                [reqEq]
              );
              if (!resource) {
                throw new Error(`Required resource allocation became unavailable: ${reqEq}.`);
              }
              const resourceUpdate = await run(
                `UPDATE resources SET allocated_count = allocated_count + 1 WHERE id = ? AND allocated_count < total_count`,
                [resource.id]
              );
              if (resourceUpdate.changes !== 1) {
                throw new Error(`Required resource allocation became unavailable: ${reqEq}.`);
              }
              await run(
                `INSERT INTO resource_allocations (id, resource_id, patient_id, assignment_id, quantity) VALUES (?, ?, ?, ?, 1)`,
                [`RAL-${patientId}-${reqEq}`, resource.id, patientId, assignmentId]
              );
            }

            await run(`UPDATE patients SET assigned_doctor_id = ?, assigned_room_id = ?, status = 'UNDER_CARE' WHERE id = ?`, [assignedDoctor.id, assignedRoom.id, patientId]);
            admissionStatus = 'UNDER_CARE';

            await run(
              `INSERT INTO ai_decisions (id, patient_id, decision_type, algorithm_used, score_cost, decision_data_json, explanation_text) VALUES (?, ?, 'AUTOMATED_CARE_ALLOCATION', 'CSP_WEIGHTED_OPTIMIZER', ?, ?, ?)`,
              [`DEC-${patientId}`, patientId, bestScore, JSON.stringify({ assignedDoctor: assignedDoctor.id, assignedRoom: assignedRoom.id }), `Assigned Dr. ${assignedDoctor.name} and Room ${assignedRoom.room_number}.`]
            );

            assignmentResult = {
              assignedDoctor: { ...assignedDoctor, current_load: assignedDoctor.current_load + 1 },
              assignedRoom: {
                ...assignedRoom,
                current_occupancy: assignedRoom.current_occupancy + 1,
                status: assignedRoom.current_occupancy + 1 >= assignedRoom.capacity ? 'OCCUPIED' : assignedRoom.status
              },
              score: bestScore
            };
          }
        }

        if (!assignmentResult) {
          allocationFailureReason = csp.explanation;
          await run(`UPDATE patients SET status = 'NO_FEASIBLE_ALLOCATION' WHERE id = ?`, [patientId]);
          admissionStatus = 'NO_FEASIBLE_ALLOCATION';
        }
      }

      auditLogRecord = await insertAuditLog('PATIENT_ADMITTED', req.user.role, { patientId, riskLevel, operational_priority_level: operationalPriorityLevel, priority_score: priorityResult.priority_score, status: admissionStatus }, req.user.id);
    });

    if (auditLogRecord) broadcastEvent('AUDIT_LOG_ADDED', auditLogRecord);
    broadcastEvent('PATIENT_ADMITTED', { patientId, status: admissionStatus });
    res.json({
      success: true,
      patient_id: patientId,
      status: admissionStatus,
      message: admissionStatus === 'UNDER_CARE' ? 'Patient admitted and allocated successfully.' : 'Patient admitted pending required care allocation.',
      allocation_failure_reason: allocationFailureReason,
      risk: riskLevel,
      operational_priority_level: operationalPriorityLevel,
      priority_score: priorityResult.priority_score,
      priority_factors: priorityResult.contributing_factors,
      requirements,
      assignment: assignmentResult
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 4. DOCTOR WORKSPACE & CONTINUOUS REASSESSMENT
// ----------------------------------------------------

// 4A. Personalized Doctor Profile & Metadata
app.get('/api/doctors/me', authenticateToken, requireRole('DOCTOR', 'ADMINISTRATOR', 'ADMIN'), async (req, res) => {
  try {
    const doctorId = req.user.doctor_id || req.user.id;
    let doctor = await get('SELECT * FROM doctors WHERE id = ? OR user_id = ?', [doctorId, req.user.id]);
    if (!doctor) {
      doctor = {
        id: doctorId,
        name: req.user.name,
        specialty: req.user.specialty || 'General Practice',
        department: 'General',
        availability_status: 'AVAILABLE',
        current_load: 0,
        max_capacity: 5,
        account_status: 'ACTIVE'
      };
    }
    res.json({ doctor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4B. Personalized Assigned Patients Endpoint
app.get('/api/doctors/me/patients', authenticateToken, requireRole('DOCTOR', 'ADMINISTRATOR', 'ADMIN'), async (req, res) => {
  try {
    const doctorId = req.user.doctor_id || req.user.id;
    const docRecord = await get('SELECT id, user_id FROM doctors WHERE id = ? OR user_id = ?', [doctorId, req.user.id]);
    const activeDocId = docRecord ? docRecord.id : doctorId;
    const docUserId = docRecord ? docRecord.user_id : req.user.id;

    const patients = await all(`
      SELECT DISTINCT p.*, d.name as doctor_name, r.room_number
      FROM patients p
      LEFT JOIN doctors d ON p.assigned_doctor_id = d.id OR p.assigned_doctor_id = d.user_id
      LEFT JOIN rooms r ON p.assigned_room_id = r.id
      LEFT JOIN care_team_assignments cta ON p.id = cta.patient_id AND cta.status = 'ACTIVE'
      LEFT JOIN assignments a ON p.id = a.patient_id AND a.status = 'ACTIVE'
      WHERE (
        p.assigned_doctor_id = ? OR p.assigned_doctor_id = ? OR p.assigned_doctor_id = ?
        OR cta.doctor_id = ? OR cta.doctor_id = ? OR cta.doctor_id = ?
        OR a.doctor_id = ? OR a.doctor_id = ? OR a.doctor_id = ?
      )
      AND p.status != 'DISCHARGED'
      ORDER BY CASE p.operational_priority_level WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 ELSE 4 END, p.priority_score DESC
    `, [
      doctorId, activeDocId, docUserId,
      doctorId, activeDocId, docUserId,
      doctorId, activeDocId, docUserId
    ]);

    res.json({ count: patients.length, patients });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4C. Personalized Doctor Alerts & Conflicts
app.get('/api/doctors/me/alerts', authenticateToken, requireRole('DOCTOR', 'ADMINISTRATOR', 'ADMIN'), async (req, res) => {
  try {
    const doctorId = req.user.doctor_id || req.user.id;
    const docRecord = await get('SELECT id FROM doctors WHERE id = ? OR user_id = ?', [doctorId, req.user.id]);
    const activeDocId = docRecord ? docRecord.id : doctorId;

    const alerts = await all(`
      SELECT DISTINCT c.*, p.name as patient_name
      FROM conflicts c
      LEFT JOIN patients p ON c.patient_id = p.id
      LEFT JOIN care_team_assignments cta ON p.id = cta.patient_id AND cta.status = 'ACTIVE'
      WHERE (p.assigned_doctor_id = ? OR p.assigned_doctor_id = ? OR cta.doctor_id = ? OR cta.doctor_id = ? OR c.severity = 'CRITICAL')
      ORDER BY c.detected_at DESC
    `, [doctorId, activeDocId, doctorId, activeDocId]);

    res.json({ count: alerts.length, alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4D. Personalized Doctor Workload & Capacity
app.get('/api/doctors/me/workload', authenticateToken, requireRole('DOCTOR', 'ADMINISTRATOR', 'ADMIN'), async (req, res) => {
  try {
    const doctorId = req.user.doctor_id || req.user.id;
    let doc = await get('SELECT * FROM doctors WHERE id = ? OR user_id = ?', [doctorId, req.user.id]);
    if (!doc) {
      doc = { id: doctorId, name: req.user.name, current_load: 0, max_capacity: 5, availability_status: 'AVAILABLE' };
    }
    const pct = Math.round((doc.current_load / (doc.max_capacity || 1)) * 100);
    res.json({
      doctor_id: doc.id,
      name: doc.name,
      current_load: doc.current_load,
      max_capacity: doc.max_capacity,
      availability_status: doc.availability_status,
      workload_percentage: pct
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4E. Personalized Doctor Assignments & Room Locations
app.get('/api/doctors/me/assignments', authenticateToken, requireRole('DOCTOR', 'ADMINISTRATOR', 'ADMIN'), async (req, res) => {
  try {
    const doctorId = req.user.doctor_id || req.user.id;
    const docRecord = await get('SELECT id FROM doctors WHERE id = ? OR user_id = ?', [doctorId, req.user.id]);
    const activeDocId = docRecord ? docRecord.id : doctorId;

    const assignments = await all(`
      SELECT a.*, p.name as patient_name, p.clinical_risk_level, p.operational_priority_level, r.room_number
      FROM assignments a
      JOIN patients p ON a.patient_id = p.id
      LEFT JOIN rooms r ON a.room_id = r.id
      WHERE (a.doctor_id = ? OR a.doctor_id = ?) AND a.status = 'ACTIVE'
    `, [doctorId, activeDocId]);

    res.json({ count: assignments.length, assignments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/doctor/patients', authenticateToken, requireRole('DOCTOR', 'ADMIN'), async (req, res) => {
  try {
    let sql = `
      SELECT p.*, d.name as doctor_name, r.room_number
      FROM patients p
      LEFT JOIN doctors d ON p.assigned_doctor_id = d.id
      LEFT JOIN rooms r ON p.assigned_room_id = r.id
      WHERE p.status != 'DISCHARGED'
    `;
    const params = [];

    // If specific doctor logged in, prioritize their patients
    if (req.user.role === 'DOCTOR' && req.user.specialty) {
      sql += ` AND (d.user_id = ? OR d.specialty = ? OR p.clinical_risk_level IN ('HIGH', 'CRITICAL'))`;
      params.push(req.user.id, req.user.specialty);
    }

    sql += ` ORDER BY p.priority_score DESC`;
    const patients = await all(sql, params);
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/patients/:id/observations', authenticateToken, requireRole('DOCTOR', 'ADMIN'), async (req, res) => {
  try {
    const patientId = req.params.id;

    if (req.user.role === 'DOCTOR') {
      const doctorId = req.user.doctor_id || req.user.id;
      const isAuthorized = await canDoctorAccessPatient(doctorId, patientId);
      if (!isAuthorized) {
        return res.status(403).json({ error: `Forbidden. Doctor '${doctorId}' is not assigned to patient '${patientId}' care team.` });
      }
    }

    const { observations } = req.body;
    const validation = validateObservationPayload(observations);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const reassessment = await processClinicalObservations(patientId, observations, req.user);

    broadcastEvent('CLINICAL_REASSESSMENT', { patientId, reassessment });
    res.json({ success: true, reassessment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DOCTOR CLINICAL RISK ASSESSMENT ENDPOINT
app.post('/api/patients/:id/risk-assessment', authenticateToken, requireRole('DOCTOR'), async (req, res) => {
  try {
    const patientId = req.params.id;

    if (req.user.role === 'DOCTOR') {
      const doctorId = req.user.doctor_id || req.user.id;
      const isAuthorized = await canDoctorAccessPatient(doctorId, patientId);
      if (!isAuthorized) {
        return res.status(403).json({ error: `Forbidden. Doctor '${doctorId}' is not assigned to patient '${patientId}' care team.` });
      }
    }

    const { assessed_risk, clinical_status, reason, clinical_notes, supporting_observations } = req.body;

    if (!assessed_risk || !['LOW', 'MODERATE', 'HIGH', 'CRITICAL'].includes(assessed_risk)) {
      return res.status(400).json({ error: 'Valid assessed_risk (LOW, MODERATE, HIGH, CRITICAL) is required.' });
    }

    const normalizedStatus = clinical_status ? clinical_status.replace(/\s+/g, '_').toUpperCase() : 'STABLE';
    if (!['STABLE', 'IMPROVING', 'DETERIORATING', 'DISCHARGE_READY'].includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Valid clinical_status (STABLE, IMPROVING, DETERIORATING, DISCHARGE_READY) is required.' });
    }

    // Status-Risk Consistency Validation
    if (assessed_risk === 'LOW' && normalizedStatus === 'DETERIORATING') {
      return res.status(400).json({ error: 'Clinical status DETERIORATING is inconsistent with LOW risk assessment. Please select STABLE or IMPROVING.' });
    }
    if (assessed_risk === 'CRITICAL' && (normalizedStatus === 'DISCHARGE_READY' || normalizedStatus === 'DISCHARGE READY')) {
      return res.status(400).json({ error: 'Clinical status DISCHARGE READY is inconsistent with CRITICAL risk assessment.' });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Clinical reason is required for risk assessment change.' });
    }

    const patient = await get(`SELECT * FROM patients WHERE id = ?`, [patientId]);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    const previousClinicalRisk = patient.clinical_risk_level || 'LOW';
    const currentSystemRisk = patient.system_calculated_risk || patient.clinical_risk_level || 'LOW';

    // Fetch latest recorded observations to build current physiological picture
    const allObsRows = await all(`SELECT * FROM observation_history WHERE patient_id = ? ORDER BY recorded_at ASC`, [patientId]);
    const latestVitals = {};
    let latestConsciousness = patient.consciousness_state || 'ALERT';
    const symptomsSet = new Set();
    for (const row of allObsRows) {
      const type = row.observation_type.toLowerCase();
      if (['hr', 'bp_sys', 'bp_dia', 'spo2', 'resp_rate', 'temp'].includes(type)) {
        latestVitals[type] = row.value === 'NOT_ASSESSED' ? 'NOT_ASSESSED' : Number(row.value);
      } else if (type === 'consciousness') {
        latestConsciousness = row.value;
      } else if (type === 'symptom') {
        symptomsSet.add(row.value);
      }
    }

    // Recalculate Operational Priority based on prioritization policy
    const priorityResult = calculatePriority({
      emergency_category: patient.emergency_category,
      consciousness_state: latestConsciousness,
      symptoms: Array.from(symptomsSet),
      vitals: latestVitals,
      clinical_status: normalizedStatus,
      doctor_assessed_risk: assessed_risk
    });

    // Run Risk Reconciliation with doctor assessment as authoritative for clinical evaluation
    const reconciliation = reconcileRiskAndPriority({
      systemRisk: currentSystemRisk,
      doctorAssessedRisk: assessed_risk,
      clinicalStatus: normalizedStatus,
      systemPriority: priorityResult.priority_level,
      priorityScore: priorityResult.priority_score,
      source: 'DOCTOR_ASSESSMENT'
    });

    if (normalizedStatus === 'DISCHARGE_READY' && patient.status !== 'DISCHARGED') {
      if (reconciliation.reconciliation_status === 'REVIEW_REQUIRED') {
        return res.status(400).json({ error: 'Cannot set clinical status to DISCHARGE READY while high-acuity safety protocol is active (System Risk is CRITICAL). Clinical review required.' });
      }
    }

    let dischargeRequestCreated = false;
    let replanningResult = null;
    let dischargeAuditLog = null;
    let riskAuditLog = null;

    await transaction(async () => {
      // 1. Record Clinical Risk Assessment Record (preserving resulting_priority)
      const assessmentId = `CRA-${Date.now()}`;
      const encounterId = `ENC-${patientId}`;
      await run(
        `INSERT INTO clinical_risk_assessments (id, patient_id, encounter_id, doctor_id, doctor_name, previous_risk, assessed_risk, clinical_status, reason, clinical_notes, supporting_observations, resulting_priority, reconciliation_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          assessmentId, patientId, encounterId, req.user.id, req.user.name,
          previousClinicalRisk, assessed_risk, normalizedStatus, reason.trim(),
          clinical_notes || '', supporting_observations || '',
          reconciliation.effective_priority, reconciliation.reconciliation_status
        ]
      );

      // 2. Record Risk History Transition Event
      await run(
        `INSERT INTO risk_history (id, patient_id, previous_risk, new_risk, contributing_factors_json) VALUES (?, ?, ?, ?, ?)`,
        [
          `RSK-${Date.now()}`, patientId, previousClinicalRisk, assessed_risk,
          JSON.stringify([
            `Doctor Assessment: ${assessed_risk}`,
            `Status: ${normalizedStatus}`,
            `Reason: ${reason.trim()}`
          ])
        ]
      );

      // 3. Record Priority History Event if priority level changed
      if (reconciliation.effective_priority !== patient.operational_priority_level) {
        await run(
          `INSERT INTO priority_history (id, patient_id, previous_priority, new_priority, priority_score, reason) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            `PRY-${Date.now()}`, patientId, patient.operational_priority_level,
            reconciliation.effective_priority, reconciliation.priority_score,
            `Doctor risk assessment change: ${reason.trim()}`
          ]
        );
      }

      // 4. Update Patient Record (DO NOT fabricate or alter vitals!)
      let newPatientStatus = patient.status;
      if (normalizedStatus === 'DISCHARGE_READY' && patient.status !== 'DISCHARGED') {
        newPatientStatus = 'DISCHARGE_REQUESTED';
      }

      await run(
        `UPDATE patients
         SET clinical_risk_level = ?,
             doctor_assessed_risk = ?,
             system_calculated_risk = ?,
             clinical_status = ?,
             risk_reconciliation_status = ?,
             operational_priority_level = ?,
             priority_score = ?,
             status = ?
         WHERE id = ?`,
        [
          reconciliation.effective_risk,
          assessed_risk,
          currentSystemRisk,
          normalizedStatus,
          reconciliation.reconciliation_status,
          reconciliation.effective_priority,
          reconciliation.priority_score,
          newPatientStatus,
          patientId
        ]
      );

      // 4b. Resolve obsolete active conflicts / alerts if patient de-escalated
      if (reconciliation.effective_priority === 'P3' || reconciliation.effective_priority === 'P4' || reconciliation.effective_risk === 'LOW' || reconciliation.effective_risk === 'MODERATE') {
        await run(
          `UPDATE conflicts
           SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP, resolution_notes = ?
           WHERE (patient_id = ? OR patient_ids_json LIKE ?) AND status = 'ACTIVE'`,
          [
            `Resolved automatically following clinical de-escalation (${reconciliation.effective_risk}, ${reconciliation.effective_priority})`,
            patientId,
            `%"${patientId}"%`
          ]
        );
      }

      // 5. Recalculate & Update Patient Requirements
      const updatedReqs = deriveRequirements(
        { emergency_category: patient.emergency_category },
        { priority_level: reconciliation.effective_priority }
      );

      await run(
        `UPDATE patient_requirements
         SET care_level = ?, room_type = ?, monitoring_level = ?
         WHERE patient_id = ?`,
        [updatedReqs.care_level, updatedReqs.room_type, updatedReqs.monitoring_level, patientId]
      );

      // 6. If DISCHARGE READY, create a Pending Discharge Request for Receptionist review
      if (normalizedStatus === 'DISCHARGE_READY') {
        const existingPending = await get(
          `SELECT id FROM discharge_requests WHERE patient_id = ? AND status = 'PENDING'`,
          [patientId]
        );

        if (!existingPending) {
          const reqId = `DIS-REQ-${Date.now()}`;
          await run(
            `INSERT INTO discharge_requests (id, patient_id, requesting_doctor_id, requesting_doctor_name, clinical_assessment, final_condition, discharge_instructions, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
            [
              reqId, patientId, req.user.id, req.user.name,
              reason.trim(), 'STABLE',
              clinical_notes || 'Patient assessed as DISCHARGE READY by attending physician.'
            ]
          );
          dischargeRequestCreated = true;
          dischargeAuditLog = await insertAuditLog('DISCHARGE_REQUEST_CREATED', req.user.role, { requestId: reqId, patientId }, req.user.id);
        }
      }

      // 7. Evaluate Dynamic Replanning if acuity level changed
      if (previousClinicalRisk !== reconciliation.effective_risk) {
        const activePats = await all(`SELECT * FROM patients WHERE status != 'DISCHARGED'`);
        const docs = await all(`SELECT * FROM doctors`);
        const rms = await all(`SELECT * FROM rooms`);
        const resList = await all(`SELECT * FROM resources`);

        replanningResult = await evaluateDynamicReplanning(
          {
            type: 'CLINICAL_RISK_ASSESSMENT_CHANGED',
            patientId,
            details: {
              patientName: patient.name,
              previousRisk: previousClinicalRisk,
              effectiveRisk: reconciliation.effective_risk,
              doctorAssessedRisk: assessed_risk
            }
          },
          activePats,
          docs,
          rms,
          resList
        );
      }

      // 8. Log Audit Event
      riskAuditLog = await insertAuditLog('CLINICAL_RISK_ASSESSED', req.user.role, {
        patientId,
        previousRisk: previousClinicalRisk,
        doctorAssessedRisk: assessed_risk,
        effectiveRisk: reconciliation.effective_risk,
        clinicalStatus: clinical_status,
        reason: reason.trim(),
        reconciliationStatus: reconciliation.reconciliation_status
      }, req.user.id);
    });

    if (dischargeAuditLog) broadcastEvent('AUDIT_LOG_ADDED', dischargeAuditLog);
    if (riskAuditLog) broadcastEvent('AUDIT_LOG_ADDED', riskAuditLog);
    broadcastEvent('CLINICAL_RISK_ASSESSED', {
      patientId,
      doctorAssessedRisk: assessed_risk,
      effectiveRisk: reconciliation.effective_risk,
      clinicalStatus: clinical_status,
      reconciliation
    });
    broadcastEvent('PATIENT_UPDATED', { patientId, operational_priority_level: reconciliation.effective_priority, clinical_risk_level: reconciliation.effective_risk });
    broadcastEvent('ALERTS_UPDATED', { patientId });

    res.json({
      success: true,
      patient_id: patientId,
      doctor_assessed_risk: assessed_risk,
      system_risk: currentSystemRisk,
      effective_risk: reconciliation.effective_risk,
      effective_priority: reconciliation.effective_priority,
      reconciliation,
      replanning: replanningResult,
      discharge_request_created: dischargeRequestCreated
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/patients/:id/history', authenticateToken, async (req, res) => {
  try {
    const patientId = req.params.id;

    if (req.user.role === 'DOCTOR') {
      const doctorId = req.user.doctor_id || req.user.id;
      const isAuthorized = await canDoctorAccessPatient(doctorId, patientId);
      if (!isAuthorized) {
        return res.status(403).json({ error: `Forbidden. Doctor '${doctorId}' is not assigned to patient '${patientId}' care team.` });
      }
    }

    const observations = await all(`SELECT * FROM observation_history WHERE patient_id = ? ORDER BY recorded_at DESC`, [patientId]);
    const risks = await all(`SELECT * FROM risk_history WHERE patient_id = ? ORDER BY calculated_at DESC`, [patientId]);
    const priorities = await all(`SELECT * FROM priority_history WHERE patient_id = ? ORDER BY calculated_at DESC`, [patientId]);
    const clinicalAssessments = await all(`SELECT * FROM clinical_risk_assessments WHERE patient_id = ? ORDER BY created_at DESC`, [patientId]);

    res.json({
      observations,
      risk_history: risks,
      priority_history: priorities,
      clinical_assessments: clinicalAssessments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 5. PATIENT QUERY & DISCHARGE WORKFLOW
// ----------------------------------------------------
// GET /api/patients/active -> Canonical endpoint returning active admissions (status != 'DISCHARGED') as Patient[]
app.get('/api/patients/active', authenticateToken, async (req, res) => {
  try {
    const patients = await all(`
      SELECT p.*, d.name as doctor_name, r.room_number
      FROM patients p
      LEFT JOIN doctors d ON p.assigned_doctor_id = d.id
      LEFT JOIN rooms r ON p.assigned_room_id = r.id
      WHERE p.status != 'DISCHARGED'
      ORDER BY p.priority_score DESC, p.admission_time DESC
    `);
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/patients -> Full patient catalog query with optional status, priority, search filters
app.get('/api/patients', authenticateToken, async (req, res) => {
  try {
    const { status, priority, search } = req.query;
    let sql = `
      SELECT p.*, d.name as doctor_name, r.room_number
      FROM patients p
      LEFT JOIN doctors d ON p.assigned_doctor_id = d.id
      LEFT JOIN rooms r ON p.assigned_room_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ` AND p.status = ?`;
      params.push(status);
    }
    if (priority) {
      sql += ` AND p.operational_priority_level = ?`;
      params.push(priority);
    }
    if (search) {
      sql += ` AND (p.name LIKE ? OR p.id LIKE ? OR p.emergency_category LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY p.priority_score DESC, p.admission_time DESC`;
    const patients = await all(sql, params);
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/patients/discharged', authenticateToken, requireRole('RECEPTIONIST', 'DOCTOR', 'ADMINISTRATOR', 'ADMIN'), async (req, res) => {
  try {
    const discharged = await all(`
      SELECT 
        p.id, p.name, p.age, p.gender, p.emergency_category, p.contact, p.status,
        p.clinical_risk_level, p.operational_priority_level, p.priority_score,
        p.doctor_assessed_risk, p.clinical_status, p.admission_time,
        d.id as discharge_id, d.clinical_summary, d.administrative_notes, d.length_of_stay_hours, d.discharged_at, d.discharged_by_doctor, d.completed_by_receptionist,
        dr.id as discharge_request_id, dr.requesting_doctor_name, dr.final_condition, dr.discharge_instructions, dr.follow_up_required, dr.follow_up_notes,
        doc.name as assigned_doctor_name, doc.specialty as doctor_specialty,
        r.room_number, r.room_type,
        e.id as encounter_id, e.admitted_at
      FROM patients p
      LEFT JOIN discharges d ON p.id = d.patient_id
      LEFT JOIN discharge_requests dr ON d.discharge_request_id = dr.id OR (dr.patient_id = p.id AND dr.status = 'APPROVED')
      LEFT JOIN doctors doc ON p.assigned_doctor_id = doc.id
      LEFT JOIN rooms r ON p.assigned_room_id = r.id
      LEFT JOIN encounters e ON p.id = e.patient_id
      WHERE p.status = 'DISCHARGED' OR d.id IS NOT NULL
      GROUP BY p.id
      ORDER BY d.discharged_at DESC, p.admission_time DESC
    `);
    res.json(discharged);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/patients/:id', authenticateToken, requireRole('RECEPTIONIST', 'DOCTOR', 'ADMINISTRATOR', 'ADMIN'), async (req, res) => {
  try {
    if (req.user.role === 'DOCTOR') {
      const doctorId = req.user.doctor_id || req.user.id;
      const isAuthorized = await canDoctorAccessPatient(doctorId, req.params.id);
      if (!isAuthorized) {
        return res.status(403).json({ error: `Forbidden. Doctor '${doctorId}' is not assigned to patient '${req.params.id}' care team.` });
      }
    }

    const patient = await get(`
      SELECT p.*, d.name as assigned_doctor_name, d.specialty as assigned_doctor_specialty, r.room_number as assigned_room_number, r.room_type as assigned_room_type
      FROM patients p
      LEFT JOIN doctors d ON p.assigned_doctor_id = d.id
      LEFT JOIN rooms r ON p.assigned_room_id = r.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!patient) return res.status(404).json({ error: 'Patient record not found.' });

    const encounter = await get(`SELECT * FROM encounters WHERE patient_id = ? ORDER BY admitted_at DESC LIMIT 1`, [patient.id]);
    const requirements = await get(`SELECT * FROM patient_requirements WHERE patient_id = ?`, [patient.id]);
    const assignment = await get(`
      SELECT a.*, d.name as doctor_name, d.specialty as doctor_specialty, r.room_number, r.room_type
      FROM assignments a
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN rooms r ON a.room_id = r.id
      WHERE a.patient_id = ? ORDER BY a.assigned_at DESC LIMIT 1
    `, [patient.id]);
    const dischargeRequest = await get(`SELECT * FROM discharge_requests WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1`, [patient.id]);
    const discharge = await get(`SELECT * FROM discharges WHERE patient_id = ? ORDER BY discharged_at DESC LIMIT 1`, [patient.id]);
    const aiDecisions = await all(`SELECT * FROM ai_decisions WHERE patient_id = ? ORDER BY created_at DESC`, [patient.id]);
    const obsHistory = await all(`SELECT * FROM observation_history WHERE patient_id = ? ORDER BY recorded_at DESC`, [patient.id]);
    const riskHistory = await all(`SELECT * FROM risk_history WHERE patient_id = ? ORDER BY calculated_at DESC`, [patient.id]);
    const priorityHistory = await all(`SELECT * FROM priority_history WHERE patient_id = ? ORDER BY calculated_at DESC`, [patient.id]);
    const clinicalAssessments = await all(`SELECT * FROM clinical_risk_assessments WHERE patient_id = ? ORDER BY created_at DESC`, [patient.id]);

    const structuredPayload = {
      patient,
      encounter: encounter || { id: `ENC-${patient.id}`, status: patient.status, admitted_at: patient.admission_time },
      currentRisk: {
        effective_risk: patient.clinical_risk_level || 'LOW',
        doctor_assessed_risk: patient.doctor_assessed_risk || 'NOT SET',
        system_calculated_risk: patient.system_calculated_risk || patient.clinical_risk_level || 'LOW',
        reconciliation_status: patient.risk_reconciliation_status || 'MATCH'
      },
      currentPriority: {
        operational_priority_level: patient.operational_priority_level ?? 'NOT_ASSESSED',
        priority_score: patient.priority_score || 0
      },
      doctor: patient.assigned_doctor_name ? {
        id: patient.assigned_doctor_id,
        name: patient.assigned_doctor_name,
        specialty: patient.assigned_doctor_specialty
      } : null,
      room: patient.assigned_room_number ? {
        id: patient.assigned_room_id,
        room_number: patient.assigned_room_number,
        room_type: patient.assigned_room_type
      } : null,
      requirements,
      assignment,
      discharge_request: dischargeRequest || null,
      discharge: discharge || null,
      aiDecisions,
      history: {
        observations: obsHistory,
        risk_history: riskHistory,
        priority_history: priorityHistory,
        clinical_assessments: clinicalAssessments
      }
    };

    res.json(structuredPayload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------
// 5A. DOCTOR DISCHARGE REQUEST (Clinical Authority)
// -------------------------------------------------------
app.post('/api/patients/:id/discharge-request', authenticateToken, requireRole('DOCTOR', 'ADMIN'), async (req, res) => {
  try {
    const patientId = req.params.id;

    if (req.user.role === 'DOCTOR') {
      const doctorId = req.user.doctor_id || req.user.id;
      const isAuthorized = await canDoctorAccessPatient(doctorId, patientId);
      if (!isAuthorized) {
        return res.status(403).json({ error: `Forbidden. Doctor '${doctorId}' is not assigned to patient '${patientId}' care team.` });
      }
    }

    const {
      clinical_assessment = '',
      final_condition = 'STABLE',
      discharge_instructions = '',
      follow_up_required = false,
      follow_up_notes = '',
      vitals_at_request = {},
      has_unsaved_draft = false,
      draft_assessed_risk = null
    } = req.body;

    if (has_unsaved_draft) {
      return res.status(400).json({ error: 'Cannot create discharge request while unsaved clinical assessment changes exist. Please save your assessment changes or discard draft first.' });
    }

    if (!clinical_assessment || clinical_assessment.trim().length < 10) {
      return res.status(400).json({ error: 'A clinical assessment of at least 10 characters is required to create a discharge request.' });
    }

    const patient = await get(`SELECT * FROM patients WHERE id = ?`, [patientId]);
    if (!patient) return res.status(404).json({ error: 'Patient not found.' });

    if (draft_assessed_risk && draft_assessed_risk !== (patient.doctor_assessed_risk || patient.clinical_risk_level)) {
      return res.status(400).json({ error: `Cannot create discharge request: Doctor assessment draft (${draft_assessed_risk}) does not match saved assessment (${patient.doctor_assessed_risk || patient.clinical_risk_level}). Please save or discard draft first.` });
    }
    if (patient.risk_reconciliation_status === 'REVIEW_REQUIRED' || (!patient.doctor_assessed_risk && patient.system_calculated_risk === 'CRITICAL')) {
      return res.status(400).json({ error: `Cannot create discharge request: Clinical review required due to system risk escalation (System Risk: ${patient.system_calculated_risk || 'CRITICAL'}). Please perform an updated clinical risk assessment first.` });
    }
    const currentEffectiveRisk = patient.doctor_assessed_risk || patient.clinical_risk_level;
    if (currentEffectiveRisk === 'CRITICAL') {
      return res.status(400).json({ error: 'Cannot create discharge request for a patient with CRITICAL clinical risk.' });
    }
    if (patient.status === 'DISCHARGED') return res.status(400).json({ error: 'Patient is already discharged.' });
    if (patient.status === 'DISCHARGE_REQUESTED') return res.status(400).json({ error: 'A discharge request already exists for this patient.' });

    // Look up doctor record
    const doctor = await get(`SELECT * FROM doctors WHERE user_id = ?`, [req.user.id]);
    const doctorName = doctor ? doctor.name : req.user.name;
    const doctorId = doctor ? doctor.id : 'DOC-UNKNOWN';

    const requestId = `DRQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let auditLogRecord = null;

    await transaction(async () => {
      await run(
        `INSERT INTO discharge_requests (id, patient_id, requesting_doctor_id, requesting_doctor_name, clinical_assessment, final_condition, discharge_instructions, follow_up_required, follow_up_notes, vitals_at_request_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [requestId, patientId, doctorId, doctorName, clinical_assessment, final_condition, discharge_instructions, follow_up_required ? 1 : 0, follow_up_notes, JSON.stringify(vitals_at_request)]
      );

      await run(`UPDATE patients SET status = 'DISCHARGE_REQUESTED' WHERE id = ?`, [patientId]);

      auditLogRecord = await insertAuditLog('DISCHARGE_REQUEST_CREATED', req.user.role, {
        requestId, patientId, doctorName, final_condition, clinical_assessment: clinical_assessment.substring(0, 100)
      }, req.user.id);
    });

    if (auditLogRecord) broadcastEvent('AUDIT_LOG_ADDED', auditLogRecord);
    broadcastEvent('DISCHARGE_REQUEST_CREATED', { requestId, patientId, doctorName });

    res.json({
      success: true,
      request_id: requestId,
      message: `Discharge request created for patient ${patientId}. Receptionist will review and complete administrative discharge.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------
// 5B. LIST DISCHARGE REQUESTS (Receptionist Queue)
// -------------------------------------------------------
app.get('/api/discharge-requests', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT dr.*, p.name as patient_name, p.age as patient_age, p.gender as patient_gender,
             p.emergency_category, p.clinical_risk_level, p.operational_priority_level,
             p.assigned_room_id, r.room_number
      FROM discharge_requests dr
      LEFT JOIN patients p ON dr.patient_id = p.id
      LEFT JOIN rooms r ON p.assigned_room_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ` AND dr.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY dr.created_at DESC`;
    const requests = await all(sql, params);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/discharge-requests/:id', authenticateToken, async (req, res) => {
  try {
    const request = await get(`
      SELECT dr.*, p.name as patient_name, p.age as patient_age, p.gender as patient_gender,
             p.emergency_category, p.clinical_risk_level, p.operational_priority_level,
             p.admission_time, p.assigned_room_id, p.assigned_doctor_id,
             r.room_number, d.name as doctor_name
      FROM discharge_requests dr
      LEFT JOIN patients p ON dr.patient_id = p.id
      LEFT JOIN rooms r ON p.assigned_room_id = r.id
      LEFT JOIN doctors d ON dr.requesting_doctor_id = d.id
      WHERE dr.id = ?
    `, [req.params.id]);

    if (!request) return res.status(404).json({ error: 'Discharge request not found.' });
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------
// 5C. RECEPTIONIST APPROVES DISCHARGE (Administrative)
// -------------------------------------------------------
app.post('/api/discharge-requests/:id/approve', authenticateToken, requireRole('RECEPTIONIST', 'ADMINISTRATOR', 'ADMIN'), async (req, res) => {
  try {
    const requestId = req.params.id;
    const {
      administrative_notes = '',
      identity_verified = false,
      doctor_request_reviewed = false,
      administrative_summary_completed = false
    } = req.body;

    // Server-validated Administrative Checklist (Correction 8)
    if (!identity_verified || !doctor_request_reviewed || !administrative_summary_completed) {
      return res.status(400).json({
        error: 'Administrative checklist incomplete. Identity verification, request review, and administrative summary completion are mandatory prior to discharge.'
      });
    }

    const request = await get(`SELECT * FROM discharge_requests WHERE id = ?`, [requestId]);
    if (!request) return res.status(404).json({ error: 'Discharge request not found.' });

    const patientId = request.patient_id;
    const patient = await get(`SELECT * FROM patients WHERE id = ?`, [patientId]);
    if (!patient) return res.status(404).json({ error: 'Associated patient record not found.' });

    // Idempotency Check (Correction 7 & 13)
    if (patient.status === 'DISCHARGED') {
      return res.status(409).json({ error: `Patient ${patientId} has already been discharged. Operation is idempotent.` });
    }
    if (request.status === 'APPROVED' || request.status === 'COMPLETED') {
      return res.status(409).json({ error: `Discharge request ${requestId} has already been finalized.` });
    }
    if (request.status !== 'PENDING' && request.status !== 'READY_FOR_COMPLETION') {
      return res.status(400).json({ error: `Cannot approve a discharge request with status '${request.status}'.` });
    }

    let auditLogRecord = null;
    await transaction(async () => {
      // 1. Update discharge request status
      await run(
        `UPDATE discharge_requests SET status = 'APPROVED', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [req.user.name, requestId]
      );

      // 2. Close active assignment & recalculate room occupancy / doctor load from database state (Corrections 3, 4, 5)
      const assignment = await get(`SELECT * FROM assignments WHERE patient_id = ? AND status = 'ACTIVE'`, [patientId]);
      if (assignment) {
        // Mark assignment completed
        await run(`UPDATE assignments SET status = 'COMPLETED', released_at = CURRENT_TIMESTAMP WHERE id = ?`, [assignment.id]);

        // Bed-First Room Release: Recalculate room occupancy directly from active assignments
        if (assignment.room_id) {
          await run(
            `UPDATE rooms SET current_occupancy = (SELECT COUNT(*) FROM assignments WHERE room_id = ? AND status = 'ACTIVE') WHERE id = ?`,
            [assignment.room_id, assignment.room_id]
          );
          const updatedRoom = await get(`SELECT * FROM rooms WHERE id = ?`, [assignment.room_id]);
          if (updatedRoom) {
            const newStatus = updatedRoom.current_occupancy >= updatedRoom.capacity ? 'OCCUPIED' : 'AVAILABLE';
            await run(`UPDATE rooms SET status = ? WHERE id = ?`, [newStatus, assignment.room_id]);
          }
        }

        // Recalculate Doctor current load directly from active assignments
        if (assignment.doctor_id) {
          await run(
            `UPDATE doctors SET current_load = (SELECT COUNT(*) FROM assignments WHERE doctor_id = ? AND status = 'ACTIVE') WHERE id = ?`,
            [assignment.doctor_id, assignment.doctor_id]
          );
        }
      }

      // 3. Release active resource allocations & recalculate availability (Correction 3)
      const activeAllocations = await all(`SELECT * FROM resource_allocations WHERE patient_id = ? AND released_at IS NULL`, [patientId]);
      for (const alloc of activeAllocations) {
        await run(
          `UPDATE resource_allocations SET released_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [alloc.id]
        );
        await run(
          `UPDATE resources SET allocated_count = (SELECT COUNT(*) FROM resource_allocations WHERE resource_id = ? AND released_at IS NULL) WHERE id = ?`,
          [alloc.resource_id, alloc.resource_id]
        );
      }

      // Fallback resource release for template allocations if no explicit resource_allocations rows exist
      if (activeAllocations.length === 0 && assignment && assignment.resources_allocated_json) {
        try {
          const allocatedResources = JSON.parse(assignment.resources_allocated_json || '[]');
          for (const reqEq of allocatedResources) {
            await run(`UPDATE resources SET allocated_count = MAX(0, allocated_count - 1) WHERE resource_type = ?`, [reqEq]);
          }
        } catch (e) { /* ignore parse errors */ }
      }

      // 4. Calculate length of stay
      const admissionTime = patient.admission_time ? new Date(patient.admission_time) : new Date(patient.created_at);
      const losHours = Math.round(((Date.now() - admissionTime.getTime()) / (1000 * 60 * 60)) * 10) / 10;

      // 5. Create formal discharge record
      const dischargeId = `DIS-${Date.now()}`;
      await run(
        `INSERT INTO discharges (id, patient_id, discharge_request_id, discharged_by_doctor, completed_by_receptionist, clinical_summary, administrative_notes, vitals_at_discharge_json, length_of_stay_hours)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dischargeId,
          patientId,
          requestId,
          request.requesting_doctor_name || 'Dr. Attending',
          req.user.name || 'Receptionist',
          request.clinical_assessment || 'Clinical discharge completed.',
          administrative_notes || '',
          request.vitals_at_request_json || '{}',
          typeof losHours === 'number' && !isNaN(losHours) ? losHours : 0
        ]
      );

      // 6. Update patient status to DISCHARGED and clear active doctor/room bindings
      await run(`UPDATE patients SET status = 'DISCHARGED', assigned_doctor_id = NULL, assigned_room_id = NULL WHERE id = ?`, [patientId]);

      // 7. Close encounter
      await run(`UPDATE encounters SET status = 'DISCHARGED', discharged_at = CURRENT_TIMESTAMP WHERE patient_id = ? AND status != 'DISCHARGED'`, [patientId]);

      // 8. Log audit event
      auditLogRecord = await insertAuditLog('DISCHARGE_APPROVED', req.user.role, {
        requestId, patientId, approvedBy: req.user.name, doctorName: request.requesting_doctor_name, losHours
      }, req.user.id);
    });

    if (auditLogRecord) broadcastEvent('AUDIT_LOG_ADDED', auditLogRecord);
    broadcastEvent('PATIENT_DISCHARGED', { patientId, requestId });

    res.json({
      success: true,
      message: `Administrative discharge completed for patient ${patientId}. Doctor, bed, room, and resources released.`
    });
  } catch (err) {
    console.error('Discharge approve error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------
// 5D. RETURN DISCHARGE REQUEST TO DOCTOR FOR CLARIFICATION
// -------------------------------------------------------
app.post('/api/discharge-requests/:id/return', authenticateToken, requireRole('RECEPTIONIST', 'ADMINISTRATOR', 'ADMIN'), async (req, res) => {
  try {
    const requestId = req.params.id;
    const { clarification_reason } = req.body;

    if (!clarification_reason || typeof clarification_reason !== 'string' || clarification_reason.trim().length === 0) {
      return res.status(400).json({ error: 'Clarification reason is mandatory when returning a discharge request to doctor.' });
    }

    const request = await get(`SELECT * FROM discharge_requests WHERE id = ?`, [requestId]);
    if (!request) return res.status(404).json({ error: 'Discharge request not found.' });
    if (request.status !== 'PENDING') return res.status(400).json({ error: `Cannot return request with status '${request.status}'.` });

    let auditLogRecord = null;
    await transaction(async () => {
      // Update discharge request status to RETURNED_FOR_CLARIFICATION
      await run(
        `UPDATE discharge_requests SET status = 'RETURNED_FOR_CLARIFICATION', rejection_reason = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [clarification_reason.trim(), req.user.name, requestId]
      );

      // Patient remains ACTIVE under RETURNED_FOR_CLARIFICATION state
      await run(`UPDATE patients SET status = 'RETURNED_FOR_CLARIFICATION' WHERE id = ?`, [request.patient_id]);

      auditLogRecord = await insertAuditLog('DISCHARGE_REQUEST_RETURNED', req.user.role, {
        requestId, patientId: request.patient_id, returnedBy: req.user.name, reason: clarification_reason.trim()
      }, req.user.id);
    });

    if (auditLogRecord) broadcastEvent('AUDIT_LOG_ADDED', auditLogRecord);
    broadcastEvent('DISCHARGE_REQUEST_RETURNED', { requestId, patientId: request.patient_id, reason: clarification_reason.trim() });

    res.json({
      success: true,
      message: `Discharge request returned to Dr. ${request.requesting_doctor_name} for clarification.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------
// 5E. DOCTOR REVISES & RESUBMITS DISCHARGE REQUEST
// -------------------------------------------------------
app.post('/api/discharge-requests/:id/resubmit', authenticateToken, requireRole('DOCTOR', 'ADMINISTRATOR', 'ADMIN'), async (req, res) => {
  try {
    const requestId = req.params.id;
    const {
      clinical_assessment = '',
      final_condition = 'STABLE',
      discharge_instructions = '',
      follow_up_required = false,
      follow_up_notes = ''
    } = req.body;

    if (!clinical_assessment || clinical_assessment.trim().length < 10) {
      return res.status(400).json({ error: 'Revised clinical assessment of at least 10 characters is required.' });
    }

    const request = await get(`SELECT * FROM discharge_requests WHERE id = ?`, [requestId]);
    if (!request) return res.status(404).json({ error: 'Discharge request not found.' });

    let auditLogRecordResubmit = null;
    await transaction(async () => {
      await run(
        `UPDATE discharge_requests
         SET status = 'PENDING',
             clinical_assessment = ?,
             final_condition = ?,
             discharge_instructions = ?,
             follow_up_required = ?,
             follow_up_notes = ?,
             created_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [clinical_assessment.trim(), final_condition, discharge_instructions, follow_up_required ? 1 : 0, follow_up_notes, requestId]
      );

      await run(`UPDATE patients SET status = 'DISCHARGE_REQUESTED' WHERE id = ?`, [request.patient_id]);

      auditLogRecordResubmit = await insertAuditLog('DISCHARGE_REQUEST_RESUBMITTED', req.user.role, {
        requestId, patientId: request.patient_id, doctorName: req.user.name
      }, req.user.id);
    });

    if (auditLogRecordResubmit) broadcastEvent('AUDIT_LOG_ADDED', auditLogRecordResubmit);
    broadcastEvent('DISCHARGE_REQUEST_RESUBMITTED', { requestId, patientId: request.patient_id });

    res.json({
      success: true,
      message: `Discharge request resubmitted to Reception queue for patient ${request.patient_id}.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------
// 5F. DOCTOR CANCELS DISCHARGE REQUEST
// -------------------------------------------------------
app.post('/api/discharge-requests/:id/cancel', authenticateToken, requireRole('DOCTOR', 'ADMINISTRATOR', 'ADMIN'), async (req, res) => {
  try {
    const requestId = req.params.id;
    const request = await get(`SELECT * FROM discharge_requests WHERE id = ?`, [requestId]);
    if (!request) return res.status(404).json({ error: 'Discharge request not found.' });
    if (request.status !== 'PENDING' && request.status !== 'RETURNED_FOR_CLARIFICATION') {
      return res.status(400).json({ error: `Cannot cancel a request that has status '${request.status}'.` });
    }

    let auditLogRecordCancel = null;
    await transaction(async () => {
      await run(`UPDATE discharge_requests SET status = 'CANCELLED', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`, [req.user.name, requestId]);
      await run(`UPDATE patients SET status = 'UNDER_CARE' WHERE id = ?`, [request.patient_id]);

      auditLogRecordCancel = await insertAuditLog('DISCHARGE_REQUEST_CANCELLED', req.user.role, {
        requestId, patientId: request.patient_id, cancelledBy: req.user.name
      }, req.user.id);
    });

    if (auditLogRecordCancel) broadcastEvent('AUDIT_LOG_ADDED', auditLogRecordCancel);
    broadcastEvent('DISCHARGE_REQUEST_CANCELLED', { requestId, patientId: request.patient_id });
    res.json({ success: true, message: `Discharge request ${requestId} cancelled. Patient returned to active care.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 6. ASSET MANAGEMENT (DOCTORS, ROOMS, RESOURCES)
// ----------------------------------------------------
app.get('/api/doctors', authenticateToken, async (req, res) => {
  try {
    const doctors = await all(`SELECT * FROM doctors ORDER BY specialty, name`);
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Doctor Account Creation (Atomic Transaction)
app.post('/api/admin/doctors', authenticateToken, requireRole('ADMINISTRATOR', 'ADMIN'), async (req, res) => {
  try {
    const {
      name,
      email,
      username,
      password,
      doctor_id,
      specialty = 'General Medicine',
      department = 'General',
      qualification = 'MD',
      contact = 'N/A',
      shift = 'DAY',
      max_capacity = 5
    } = req.body;

    if (!name || !email || !password || !specialty) {
      return res.status(400).json({ error: 'Name, email, password, and specialty are required to create a doctor account.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = (username || cleanEmail.split('@')[0]).toLowerCase().trim();
    const doctorId = doctor_id ? doctor_id.trim() : `DOC-${Date.now().toString().slice(-4)}`;
    const userId = `USR-DOC-${Date.now().toString().slice(-4)}`;

    const existingUser = await get('SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(username) = ? OR doctor_id = ?', [cleanEmail, cleanUsername, doctorId]);
    if (existingUser) {
      return res.status(400).json({ error: 'A user or doctor with this email, username, or doctor ID already exists.' });
    }

    const passwordHash = hashPassword(password);

    let auditLogRecordCreate = null;
    await transaction(async () => {
      await run(
        `INSERT INTO doctors (id, name, specialty, current_load, max_capacity, availability_status, department, qualification, contact, shift, account_status, user_id)
         VALUES (?, ?, ?, 0, ?, 'AVAILABLE', ?, ?, ?, ?, 'ACTIVE', ?)`,
        [doctorId, name.trim(), specialty.trim(), parseInt(max_capacity) || 5, department.trim(), qualification.trim(), contact.trim(), shift, userId]
      );

      await run(
        `INSERT INTO users (id, email, password_hash, role, name, specialty, username, doctor_id, status)
         VALUES (?, ?, ?, 'DOCTOR', ?, ?, ?, ?, 'ACTIVE')`,
        [userId, cleanEmail, passwordHash, name.trim(), specialty.trim(), cleanUsername, doctorId]
      );

      auditLogRecordCreate = await insertAuditLog('ADMIN_CREATED_DOCTOR_ACCOUNT', req.user.role, {
        doctorId, userId, name, email: cleanEmail, specialty
      }, req.user.id);
    });

    if (auditLogRecordCreate) broadcastEvent('AUDIT_LOG_ADDED', auditLogRecordCreate);
    broadcastEvent('DOCTOR_CREATED', { doctorId, name, specialty });

    res.status(201).json({
      success: true,
      message: `Doctor account created successfully for Dr. ${name}.`,
      doctor_id: doctorId,
      user_id: userId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Doctor Account Update & Session Termination
app.put('/api/admin/doctors/:id', authenticateToken, requireRole('ADMINISTRATOR', 'ADMIN'), async (req, res) => {
  try {
    const doctorId = req.params.id;
    const doctor = await get('SELECT * FROM doctors WHERE id = ?', [doctorId]);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor record not found.' });
    }

    const {
      name,
      specialty,
      department,
      qualification,
      contact,
      shift,
      availability_status,
      account_status,
      max_capacity
    } = req.body;

    const newStatus = account_status || doctor.account_status || 'ACTIVE';

    let auditLogRecordUpdate = null;
    await transaction(async () => {
      await run(
        `UPDATE doctors SET 
           name = COALESCE(?, name),
           specialty = COALESCE(?, specialty),
           department = COALESCE(?, department),
           qualification = COALESCE(?, qualification),
           contact = COALESCE(?, contact),
           shift = COALESCE(?, shift),
           availability_status = COALESCE(?, availability_status),
           account_status = ?,
           max_capacity = COALESCE(?, max_capacity)
         WHERE id = ?`,
        [name, specialty, department, qualification, contact, shift, availability_status, newStatus, max_capacity, doctorId]
      );

      const user = await get('SELECT id FROM users WHERE doctor_id = ? OR id = ?', [doctorId, doctor.user_id]);
      if (user) {
        if (newStatus === 'INACTIVE') {
          await run('UPDATE users SET status = ?, token_version = token_version + 1 WHERE id = ?', [newStatus, user.id]);
        } else {
          await run('UPDATE users SET status = ? WHERE id = ?', [newStatus, user.id]);
        }
      }

      auditLogRecordUpdate = await insertAuditLog('ADMIN_UPDATED_DOCTOR_ACCOUNT', req.user.role, {
        doctorId, updatedBy: req.user.name, account_status: newStatus
      }, req.user.id);
    });

    if (auditLogRecordUpdate) broadcastEvent('AUDIT_LOG_ADDED', auditLogRecordUpdate);
    broadcastEvent('DOCTOR_UPDATED', { doctorId, account_status: newStatus });

    res.json({ success: true, message: `Doctor ${doctorId} account updated successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const rooms = await all(`SELECT * FROM rooms ORDER BY room_type, room_number`);
    res.json(rooms.map(r => ({ ...r, equipment: JSON.parse(r.equipment_json || '[]') })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/resources', authenticateToken, async (req, res) => {
  try {
    const resources = await all(`SELECT * FROM resources ORDER BY name`);
    res.json(resources);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/rooms', authenticateToken, requireRole('ADMINISTRATOR', 'ADMIN'), async (req, res) => {
  try {
    const { room_number, room_type, care_level = 'HIGH', capacity = 1, equipment = [] } = req.body;
    if (!room_number || !room_type) {
      return res.status(400).json({ error: 'room_number and room_type are required.' });
    }
    const roomId = `RM-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`;
    const existing = await get('SELECT id FROM rooms WHERE room_number = ?', [room_number]);
    if (existing) {
      return res.status(409).json({ error: 'Room already exists.' });
    }
    await run(
      `INSERT INTO rooms (id, room_number, room_type, care_level, capacity, current_occupancy, status, equipment_json)
       VALUES (?, ?, ?, ?, ?, 0, 'AVAILABLE', ?)`,
      [roomId, room_number, room_type, care_level, capacity, JSON.stringify(equipment)]
    );
    res.status(201).json({ success: true, room_id: roomId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/resources', authenticateToken, requireRole('ADMINISTRATOR', 'ADMIN'), async (req, res) => {
  try {
    const { name, resource_type, total_count = 10 } = req.body;
    if (!name || !resource_type) {
      return res.status(400).json({ error: 'name and resource_type are required.' });
    }
    const resId = `RES-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`;
    const existing = await get('SELECT id FROM resources WHERE resource_type = ?', [resource_type]);
    if (existing) {
      await run('UPDATE resources SET total_count = total_count + ? WHERE resource_type = ?', [total_count, resource_type]);
      return res.status(200).json({ success: true, message: 'Resource inventory updated.' });
    }
    await run(
      `INSERT INTO resources (id, name, resource_type, total_count, allocated_count, status)
       VALUES (?, ?, ?, ?, 0, 'OPERATIONAL')`,
      [resId, name, resource_type, total_count]
    );
    res.status(201).json({ success: true, resource_id: resId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 7. AI DECISIONS & REPLANNING
// ----------------------------------------------------
app.get('/api/ai/decisions', authenticateToken, async (req, res) => {
  try {
    const decisions = await all(`
      SELECT d.*, p.name as patient_name
      FROM ai_decisions d
      LEFT JOIN patients p ON d.patient_id = p.id
      ORDER BY d.created_at DESC
    `);
    res.json(decisions.map(d => ({
      ...d,
      decision_data: JSON.parse(d.decision_data_json || '{}')
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/replan', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { trigger_type = 'ADMIN_TRIGGER', details = {} } = req.body;

    const patients = await all(`SELECT * FROM patients WHERE status != 'DISCHARGED'`);
    const doctors = await all(`SELECT * FROM doctors`);
    const rooms = await all(`SELECT * FROM rooms`);
    const resources = await all(`SELECT * FROM resources`);

    const replanResult = await evaluateDynamicReplanning({ type: trigger_type, details }, patients, doctors, rooms, resources);

    await run(
      `INSERT INTO ai_decisions (id, decision_type, algorithm_used, score_cost, decision_data_json, explanation_text) VALUES (?, 'DYNAMIC_REPLANNING', ?, ?, ?, ?)`,
      [`DEC-REPLAN-${Date.now()}`, replanResult.algorithm_used, replanResult.reassignments_count, JSON.stringify(replanResult), replanResult.explanation]
    );

    await logAuditEvent('REPLAN_TRIGGERED', req.user.role, { trigger_type }, req.user.id);
    broadcastEvent('REPLAN_COMPLETED', { trigger_type });

    res.json(replanResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/alerts', authenticateToken, async (req, res) => {
  try {
    const conflicts = await all(`SELECT * FROM conflicts ORDER BY detected_at DESC`);
    res.json(conflicts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 8. ANALYTICS & SIMULATION & BENCHMARKING
// ----------------------------------------------------
app.get('/api/analytics', authenticateToken, requireRole('ADMINISTRATOR', 'ADMIN'), async (req, res) => {
  try {
    const mlEvaluation = runMLModelComparison();

    // 1. Total Admissions from persisted encounters table
    const admissionsRow = await get(`SELECT COUNT(*) as total FROM encounters`);
    const totalAdmissions = admissionsRow ? admissionsRow.total : 0;

    // 2. Total Discharges from persisted discharges table
    const dischargesRow = await get(`SELECT COUNT(*) as total FROM discharges`);
    const totalDischarges = dischargesRow ? dischargesRow.total : 0;

    // 3. ICU Utilization from actual configured ICU beds and occupancy
    const icuRoomRow = await get(`
      SELECT 
        SUM(capacity) as total_cap,
        SUM(current_occupancy) as total_occ
      FROM rooms 
      WHERE UPPER(room_type) = 'ICU'
    `);

    let icuUtilizationRate = null;
    let icuStatus = 'ICU NOT CONFIGURED';

    if (icuRoomRow && icuRoomRow.total_cap && icuRoomRow.total_cap > 0) {
      const occ = icuRoomRow.total_occ || 0;
      const cap = icuRoomRow.total_cap;
      icuUtilizationRate = Math.round((occ / cap) * 1000) / 10;
      icuStatus = `${icuUtilizationRate}%`;
    }

    // 4. Avg Wait Time from persisted admission (encounters.admitted_at) vs assignment (assignments.assigned_at)
    const waitTimeRow = await get(`
      SELECT 
        AVG((julianday(a.assigned_at) - julianday(e.admitted_at)) * 1440) as avg_wait_mins,
        COUNT(a.id) as sample_count
      FROM assignments a
      JOIN encounters e ON a.patient_id = e.patient_id
      WHERE a.assigned_at IS NOT NULL AND e.admitted_at IS NOT NULL
    `);

    let avgWaitTimeMins = null;
    let waitTimeStatus = 'NO DATA';

    if (waitTimeRow && waitTimeRow.sample_count > 0 && waitTimeRow.avg_wait_mins !== null && !isNaN(waitTimeRow.avg_wait_mins)) {
      avgWaitTimeMins = Math.max(0.1, Math.round(waitTimeRow.avg_wait_mins * 10) / 10);
      waitTimeStatus = `${avgWaitTimeMins} mins`;
    }

    res.json({
      ml_models: mlEvaluation,
      throughput: {
        total_admissions: totalAdmissions,
        total_discharges: totalDischarges,
        avg_wait_time_mins: avgWaitTimeMins,
        wait_time_status: waitTimeStatus,
        icu_utilization_rate: icuUtilizationRate,
        icu_status: icuStatus
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/benchmark/run', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const patients = await all(`SELECT * FROM patients`);
    const doctors = await all(`SELECT * FROM doctors`);
    const rooms = await all(`SELECT * FROM rooms`);
    const resources = await all(`SELECT * FROM resources`);

    const benchmark = runAlgorithmBenchmark(patients, doctors, rooms, resources);
    res.json(benchmark);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/simulation/run', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { scenario = 'NORMAL_LOAD' } = req.body;
    const doctors = await all(`SELECT * FROM doctors`);
    const rooms = await all(`SELECT * FROM rooms`);
    const resources = await all(`SELECT * FROM resources`);

    const simResult = runSimulationScenario(scenario, {}, doctors, rooms, resources);
    res.json(simResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/audit', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const logs = await all(`SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100`);
    res.json(logs.map(l => ({ ...l, payload: JSON.parse(l.payload_json || '{}') })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SSE Endpoint
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);
  res.write(`data: ${JSON.stringify({ eventType: 'CONNECTED', timestamp: new Date() })}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// SPA Fallback
if (fs.existsSync(DIST_PATH)) {
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(DIST_PATH, 'index.html'));
    }
  });
}

// Start Server
const HOST = process.env.HOST || '0.0.0.0';

initDatabase().then(async () => {
  // -----------------------------------------------------------------------
  // STARTUP: Ensure exactly 1 ADMINISTRATOR and 1 RECEPTIONIST exist.
  // Create ONLY the missing account(s). Never duplicate. Never seed doctors,
  // patients, rooms, resources, or any demo/operational data.
  //
  // To add synthetic data: npm run db:populate
  // To clean all data:   npm run db:reset-data
  // -----------------------------------------------------------------------
  const adminUser = await get(`SELECT id FROM users WHERE role='ADMINISTRATOR' AND status='ACTIVE' LIMIT 1`);
  if (!adminUser) {
    console.log('[STARTUP] No active Administrator account found — creating system Administrator...');
    await run(
      `INSERT OR IGNORE INTO users
         (id, username, email, password_hash, name, role, specialty, doctor_id, token_version, status)
       VALUES ('USR-ADM-01','admin','admin@carebridge.local',?,
               'System Administrator','ADMINISTRATOR',NULL,NULL,1,'ACTIVE')`,
      [hashPassword('Admin@2026!')]
    );
    console.log('[STARTUP]   Created: admin@carebridge.local / Admin@2026!');
  }

  const recUser = await get(`SELECT id FROM users WHERE role='RECEPTIONIST' AND status='ACTIVE' LIMIT 1`);
  if (!recUser) {
    console.log('[STARTUP] No active Receptionist account found — creating system Receptionist...');
    await run(
      `INSERT OR IGNORE INTO users
         (id, username, email, password_hash, name, role, specialty, doctor_id, token_version, status)
       VALUES ('USR-REC-01','reception','reception@carebridge.local',?,
               'Reception Desk','RECEPTIONIST',NULL,NULL,1,'ACTIVE')`,
      [hashPassword('Reception@2026!')]
    );
    console.log('[STARTUP]   Created: reception@carebridge.local / Reception@2026!');
  }

  // Ensure system_settings entry exists (no data seeding — just config record)
  const hasCfg = await get(`SELECT key FROM system_settings WHERE key='config'`);
  if (!hasCfg) {
    await run(
      `INSERT OR IGNORE INTO system_settings (key, value_json) VALUES ('config', ?)`,
      [JSON.stringify({ ai_algorithm_default: 'A_STAR', human_oversight_required: true })]
    );
  }


  app.listen(PORT, HOST, () => {
    console.log(`\n====================================================`);
    console.log(`CareBridge 2.0 Production REST & Realtime Server Running`);
    console.log(`- Local Host: http://localhost:${PORT}`);
    console.log(`- Network Bind: http://0.0.0.0:${PORT}`);

    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];
        if (alias.family === 'IPv4' && !alias.internal) {
          console.log(`- Network Access: http://${alias.address}:${PORT}`);
        }
      }
    }
    console.log(`====================================================\n`);
  });
}).catch(console.error);
