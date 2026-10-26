/**
 * CareBridge 2.0 Continuous Clinical Reassessment Engine
 * Handles observation recording, immutable observation history logging,
 * automatic clinical risk & operational priority updates, and dynamic allocation reassessment.
 */

import { run, get, all, transaction } from '../database/db.js';
import { calculatePriority, reconcileRiskAndPriority } from './priorityEngine.js';
import { deriveRequirements } from './requirementEngine.js';
import { evaluateDynamicReplanning } from './replanningEngine.js';

export function validateObservationPayload(observations) {
  if (!Array.isArray(observations) || observations.length === 0) {
    return { valid: false, error: 'Observations array is required and must not be empty.' };
  }

  const warnings = [];

  for (const obs of observations) {
    if (!obs || !obs.type || obs.value === undefined || obs.value === null || String(obs.value).trim() === '') {
      return { valid: false, error: 'Malformed observation: Each entry must have a non-empty observation type and value.' };
    }

    const type = String(obs.type).toUpperCase().trim();
    const strVal = String(obs.value).trim();
    const numVal = Number(strVal);

    if (['HR', 'BP_SYS', 'BP_DIA', 'SPO2', 'RESP_RATE', 'TEMP'].includes(type)) {
      if (strVal !== 'NOT_ASSESSED' && (isNaN(numVal) || !isFinite(numVal))) {
        return { valid: false, error: `Invalid non-numeric value '${obs.value}' for observation type '${type}'.` };
      }

      if (strVal !== 'NOT_ASSESSED') {
        if (type === 'HR') {
          if (numVal < 20 || numVal > 300) {
            return { valid: false, error: `Heart Rate value ${numVal} bpm is outside physiological boundaries (20 - 300 bpm).` };
          }
          if (numVal < 30 || numVal > 220) {
            warnings.push({ type, value: numVal, warning: `Heart Rate ${numVal} bpm is critically out-of-range.` });
          }
        } else if (type === 'BP_SYS') {
          if (numVal < 30 || numVal > 300) {
            return { valid: false, error: `Systolic BP value ${numVal} mmHg is outside physiological boundaries (30 - 300 mmHg).` };
          }
          if (numVal < 70 || numVal > 200) {
            warnings.push({ type, value: numVal, warning: `Systolic BP ${numVal} mmHg is critically out-of-range.` });
          }
        } else if (type === 'BP_DIA') {
          if (numVal < 10 || numVal > 200) {
            return { valid: false, error: `Diastolic BP value ${numVal} mmHg is outside physiological boundaries (10 - 200 mmHg).` };
          }
        } else if (type === 'SPO2') {
          if (numVal < 50 || numVal > 100) {
            return { valid: false, error: `SpO2 Oxygen Saturation value ${numVal}% is outside physiological boundaries (50% - 100%).` };
          }
          if (numVal < 90) {
            warnings.push({ type, value: numVal, warning: `SpO2 ${numVal}% indicates hypoxia.` });
          }
        } else if (type === 'RESP_RATE') {
          if (numVal < 4 || numVal > 80) {
            return { valid: false, error: `Respiratory Rate value ${numVal} breaths/min is outside physiological boundaries (4 - 80 breaths/min).` };
          }
          if (numVal > 30 || numVal < 8) {
            warnings.push({ type, value: numVal, warning: `Respiratory Rate ${numVal} breaths/min is abnormal.` });
          }
        } else if (type === 'TEMP') {
          if (numVal < 25.0 || numVal > 45.0) {
            return { valid: false, error: `Temperature value ${numVal}°C is outside physiological boundaries (25.0°C - 45.0°C).` };
          }
        }
      }
    }
  }

  return { valid: true, warnings };
}

export async function processClinicalObservations(patientId, observations = [], actorUser = { id: 'SYS', name: 'Dr. System', role: 'DOCTOR' }) {
  const validation = validateObservationPayload(observations);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  let resultState = null;

  await transaction(async () => {
    // 1. Fetch Patient
    const patient = await get(`SELECT * FROM patients WHERE id = ?`, [patientId]);
    if (!patient) throw new Error(`Patient ${patientId} not found.`);

    const encounter = await get(`SELECT * FROM encounters WHERE patient_id = ? ORDER BY admitted_at DESC LIMIT 1`, [patientId]);
    const encounterId = encounter ? encounter.id : `ENC-${patientId}`;

    // 2. Insert Observations into Immutable `observation_history`
    for (const obs of observations) {
      const obsId = `OBS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await run(
        `INSERT INTO observation_history (id, patient_id, encounter_id, observation_type, value, unit, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [obsId, patientId, encounterId, obs.type.toUpperCase(), String(obs.value), obs.unit || '', obs.notes || '', actorUser.name || 'System']
      );
    }

    // 3. Fetch All Recorded Observations for Patient
    const allObsRows = await all(`SELECT * FROM observation_history WHERE patient_id = ? ORDER BY recorded_at ASC`, [patientId]);

    // Build latest vitals snapshot
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

    const symptomsList = Array.from(symptomsSet);

    // 4. Calculate Updated Priority & Clinical Risk
    const priorityResult = calculatePriority({
      emergency_category: patient.emergency_category,
      consciousness_state: latestConsciousness,
      symptoms: symptomsList,
      vitals: latestVitals
    });

    const previousRisk = patient.clinical_risk_level || 'LOW';
    const previousPriority = patient.operational_priority_level || 'NOT_ASSESSED';

    let calculatedSystemRisk = 'LOW';
    if (priorityResult.priority_level === 'P1') calculatedSystemRisk = 'CRITICAL';
    else if (priorityResult.priority_level === 'P2') calculatedSystemRisk = 'HIGH';
    else if (priorityResult.priority_level === 'P3') calculatedSystemRisk = 'MODERATE';
    else calculatedSystemRisk = 'LOW';

    // Risk Reconciliation: Reconcile System Risk with Doctor Assessed Risk (if doctor assessment exists)
    const docRisk = patient.doctor_assessed_risk;
    const reconciliation = reconcileRiskAndPriority({
      systemRisk: calculatedSystemRisk,
      doctorAssessedRisk: docRisk || calculatedSystemRisk,
      clinicalStatus: patient.clinical_status || 'STABLE',
      systemPriority: priorityResult.priority_level,
      priorityScore: priorityResult.priority_score,
      source: 'SYSTEM_OBSERVATION'
    });

    const effectiveRisk = reconciliation.effective_risk;
    const reconciliationStatus = reconciliation.reconciliation_status;
    const newRisk = effectiveRisk;

    const newPriority = reconciliation.effective_priority;
    const newScore = reconciliation.priority_score;

    const riskChanged = previousRisk !== effectiveRisk;
    const priorityChanged = previousPriority !== newPriority;

    // 5. Update Risk History if changed
    if (riskChanged) {
      await run(
        `INSERT INTO risk_history (id, patient_id, previous_risk, new_risk, contributing_factors_json)
         VALUES (?, ?, ?, ?, ?)`,
        [`RSK-${Date.now()}`, patientId, previousRisk, effectiveRisk, JSON.stringify(priorityResult.contributing_factors)]
      );
    }

    // 6. Update Priority History if changed
    if (priorityChanged) {
      await run(
        `INSERT INTO priority_history (id, patient_id, previous_priority, new_priority, priority_score, reason)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [`PRY-${Date.now()}`, patientId, previousPriority, newPriority, newScore, priorityResult.explanation]
      );
    }

    // 7. Update Patient Entity Risk & Priority (Preserve doctor_assessed_risk!)
    await run(
      `UPDATE patients
       SET consciousness_state = ?, clinical_risk_level = ?, system_calculated_risk = ?, risk_reconciliation_status = ?, operational_priority_level = ?, priority_score = ?, status = 'REASSESSMENT'
       WHERE id = ?`,
      [latestConsciousness, effectiveRisk, calculatedSystemRisk, reconciliationStatus, newPriority, newScore, patientId]
    );

    // 7b. Resolve active conflicts / alerts if patient de-escalated
    if (newPriority === 'P3' || newPriority === 'P4' || effectiveRisk === 'LOW' || effectiveRisk === 'MODERATE') {
      await run(
        `UPDATE conflicts
         SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP, resolution_notes = ?
         WHERE (patient_id = ? OR patient_ids_json LIKE ?) AND status = 'ACTIVE'`,
        [
          `Resolved automatically following clinical stabilization (${newPriority}, ${effectiveRisk})`,
          patientId,
          `%"${patientId}"%`
        ]
      );
    }

    // 8. Derive Updated Care Requirements
    const newRequirements = deriveRequirements({ emergency_category: patient.emergency_category, symptoms: symptomsList }, priorityResult);

    await run(
      `UPDATE patient_requirements
       SET specialty = ?, care_level = ?, room_type = ?, monitoring_level = ?, required_equipment_json = ?
       WHERE patient_id = ?`,
      [newRequirements.specialty, newRequirements.care_level, newRequirements.room_type, newRequirements.monitoring_level, JSON.stringify(newRequirements.required_equipment), patientId]
    );

    // 9. Evaluate Current Doctor & Room Allocation
    const activeAssignment = await get(`SELECT * FROM assignments WHERE patient_id = ? AND status = 'ACTIVE'`, [patientId]);
    let replanResult = null;
    let reallocationAction = 'CONTINUE_CURRENT_CARE';

    if (riskChanged || priorityChanged) {
      const activePatients = await all(`SELECT * FROM patients WHERE status != 'DISCHARGED'`);
      const doctors = await all(`SELECT * FROM doctors`);
      const rooms = await all(`SELECT * FROM rooms`);
      const resources = await all(`SELECT * FROM resources`);

      const triggerType = (newPriority === 'P1' || newPriority === 'P2') && previousPriority !== 'P1'
        ? 'PRIORITY_ESCALATION'
        : 'PATIENT_OBSERVATION_REASSESSMENT';

      replanResult = await evaluateDynamicReplanning(
        { type: triggerType, patientId, details: { previousRisk, newRisk: effectiveRisk, previousPriority, newPriority } },
        activePatients,
        doctors, rooms, resources
      );

      if (replanResult && replanResult.reassignments_count > 0) {
        reallocationAction = newPriority === 'P1' ? 'ESCALATION_REALLOCATION' : 'DE_ESCALATION_REALLOCATION';
      }
    }

    // 10. Record AI Decision
    const decisionId = `DEC-REASSESS-${Date.now()}`;
    const explanation = `Continuous clinical reassessment for ${patient.name} (${patientId}): Risk transition ${previousRisk} -> ${newRisk}, Priority transition ${previousPriority} -> ${newPriority}. Action: ${reallocationAction}.`;

    await run(
      `INSERT INTO ai_decisions (id, patient_id, decision_type, algorithm_used, score_cost, decision_data_json, explanation_text)
       VALUES (?, ?, 'CONTINUOUS_REASSESSMENT', 'RULE_ENGINE_ASTAR_HYBRID', ?, ?, ?)`,
      [
        decisionId, patientId, newScore,
        JSON.stringify({ previousRisk, newRisk, previousPriority, newPriority, latestVitals, replanResult }),
        explanation
      ]
    );

    // Audit Log
    await run(
      `INSERT INTO audit_logs (id, event_type, actor_role, actor_id, payload_json)
       VALUES (?, 'CLINICAL_REASSESSMENT', ?, ?, ?)`,
      [`AUD-${Date.now()}`, actorUser.role || 'DOCTOR', actorUser.id || 'SYS', JSON.stringify({ patientId, previousRisk, newRisk, previousPriority, newPriority })]
    );

    resultState = {
      patient_id: patientId,
      previous_risk: previousRisk,
      new_risk: newRisk,
      effective_risk: newRisk,
      previous_priority: previousPriority,
      new_priority: newPriority,
      risk_changed: riskChanged,
      priority_changed: priorityChanged,
      vitals_snapshot: latestVitals,
      requirements: newRequirements,
      reallocation_action: reallocationAction,
      replan_result: replanResult,
      explanation
    };
  });

  return resultState;
}
