/**
 * CareBridge Priority & Triage Engine
 * Calculates transparent patient emergency priority (P1 Critical, P2 High, P3 Moderate, P4 Low)
 * and risk scores based on emergency category, consciousness state, symptoms, and vitals.
 * Fully supports explicit controlled states like 'NOT_ASSESSED', 'PENDING', 'NOT_AVAILABLE'.
 */

export function calculatePriority(patientData) {
  const {
    emergency_category = 'GENERAL',
    consciousness_state = 'ALERT',
    symptoms = [],
    vitals = {},
    clinical_status = null,
    doctor_assessed_risk = null
  } = patientData;

  let baseScore = 20; // Default P4 Baseline
  const factors = [];

  // 1. Consciousness State Impact
  if (consciousness_state === 'UNRESPONSIVE') {
    baseScore += 50;
    factors.push('Unresponsive consciousness state (Critical GCS/AVPU score)');
  } else if (consciousness_state === 'PAIN') {
    baseScore += 35;
    factors.push('Responds only to painful stimuli (Severe neuro/systemic compromise)');
  } else if (consciousness_state === 'VOICE') {
    baseScore += 20;
    factors.push('Responds only to verbal stimuli (Altered mental status)');
  } else if (consciousness_state === 'NOT_ASSESSED') {
    factors.push('Consciousness state: NOT_ASSESSED (Controlled triage pending)');
  }

  // 2. Emergency Category Base Risk
  switch (emergency_category.toUpperCase()) {
    case 'CARDIAC':
      baseScore += 25;
      factors.push('Cardiac emergency category (High ischemia/arrhythmia risk)');
      break;
    case 'TRAUMA':
      baseScore += 25;
      factors.push('Major trauma category (High internal injury/shock risk)');
      break;
    case 'NEURO':
      baseScore += 20;
      factors.push('Neurological emergency category (Acute stroke/seizure risk)');
      break;
    case 'RESPIRATORY':
      baseScore += 20;
      factors.push('Severe respiratory distress category (Hypoxia/failure risk)');
      break;
    default:
      baseScore += 5;
      factors.push('General medical emergency category');
      break;
  }

  // 3. Vitals Assessment (accounting for NOT_ASSESSED / controlled states)
  const { hr, bp_sys, bp_dia, spo2, resp_rate, temp } = vitals;

  // Heart Rate
  if (typeof hr === 'number') {
    if (hr > 130 || hr < 45) {
      baseScore += 20;
      factors.push(`Severe heart rate abnormality: ${hr} bpm (Tachycardia/Bradycardia)`);
    } else if (hr > 110 || hr < 55) {
      baseScore += 10;
      factors.push(`Moderate heart rate abnormality: ${hr} bpm`);
    }
  } else if (hr === 'NOT_ASSESSED') {
    factors.push('Heart rate: NOT_ASSESSED');
  }

  // Blood Pressure Systolic
  if (typeof bp_sys === 'number') {
    if (bp_sys < 90 || bp_sys > 180) {
      baseScore += 20;
      factors.push(`Critical systolic blood pressure: ${bp_sys} mmHg (Shock/Crisis)`);
    } else if (bp_sys < 100 || bp_sys > 160) {
      baseScore += 10;
      factors.push(`Moderate systolic blood pressure abnormality: ${bp_sys} mmHg`);
    }
  } else if (bp_sys === 'NOT_ASSESSED') {
    factors.push('Blood pressure: NOT_ASSESSED');
  }

  // SpO2 (Oxygen Saturation)
  if (typeof spo2 === 'number') {
    if (spo2 < 90) {
      baseScore += 25;
      factors.push(`Severe hypoxia: SpO2 ${spo2}% (Immediate oxygenation required)`);
    } else if (spo2 < 94) {
      baseScore += 12;
      factors.push(`Moderate hypoxia: SpO2 ${spo2}%`);
    }
  } else if (spo2 === 'NOT_ASSESSED') {
    factors.push('SpO2: NOT_ASSESSED');
  }

  // Respiratory Rate
  if (typeof resp_rate === 'number') {
    if (resp_rate > 30 || resp_rate < 10) {
      baseScore += 15;
      factors.push(`Critical respiratory rate: ${resp_rate} breaths/min`);
    }
  }

  // Temperature
  if (typeof temp === 'number') {
    if (temp > 39.5 || temp < 35.0) {
      baseScore += 10;
      factors.push(`High fever / hypothermia: ${temp}°C`);
    }
  }

  // 4. Symptoms Keyword Impact
  const symptomText = Array.isArray(symptoms) ? symptoms.join(' ').toLowerCase() : String(symptoms).toLowerCase();
  const normStatus = clinical_status ? String(clinical_status).replace(/\s+/g, '_').toUpperCase() : '';
  const isConditionImprovingOrManaged = doctor_assessed_risk === 'LOW' || doctor_assessed_risk === 'MODERATE' || normStatus === 'IMPROVING' || normStatus === 'DISCHARGE_READY';

  if (!isConditionImprovingOrManaged) {
    if (symptomText.includes('chest pain') || symptomText.includes('st-elevation') || symptomText.includes('cardiac arrest')) {
      baseScore += 15;
      factors.push('Critical symptom: Suspected acute coronary syndrome / cardiac arrest');
    }
    if (symptomText.includes('hemorrhage') || symptomText.includes('bleeding') || symptomText.includes('shock')) {
      baseScore += 15;
      factors.push('Critical symptom: Hemorrhagic shock / active bleeding');
    }
    if (symptomText.includes('stroke') || symptomText.includes('hemiplegia') || symptomText.includes('aphasia')) {
      baseScore += 15;
      factors.push('Critical symptom: Acute focal neurological deficit');
    }
  } else if (symptomText.length > 0) {
    factors.push('Admission symptoms stabilized under active clinical management');
  }

  // 5. Clinical Trajectory & Assessment Impact
  if (doctor_assessed_risk) {
    switch (doctor_assessed_risk.toUpperCase()) {
      case 'CRITICAL':
        baseScore += 25;
        factors.push('Physician clinical assessment: CRITICAL acuity');
        break;
      case 'HIGH':
        baseScore += 10;
        factors.push('Physician clinical assessment: HIGH acuity');
        break;
      case 'MODERATE':
        baseScore -= 5;
        factors.push('Physician clinical assessment: MODERATE acuity');
        break;
      case 'LOW':
        baseScore -= 20;
        factors.push('Physician clinical assessment: LOW acuity (Condition resolving / low acuity ward care)');
        break;
    }
  }

  if (normStatus === 'DETERIORATING') {
    baseScore += 20;
    factors.push('Clinical status: DETERIORATING (Active clinical trajectory decline)');
  } else if (normStatus === 'IMPROVING') {
    baseScore -= 15;
    factors.push('Clinical status: IMPROVING (Favorable treatment response)');
  } else if (normStatus === 'DISCHARGE_READY') {
    baseScore -= 25;
    factors.push('Clinical status: DISCHARGE READY (Acuity resolved / cleared for discharge)');
  } else if (normStatus === 'STABLE' && doctor_assessed_risk) {
    baseScore -= 5;
    factors.push('Clinical status: STABLE (Condition stabilized)');
  }

  // Normalize final score between 0 and 100
  const finalScore = Math.min(100, Math.max(0, Math.round(baseScore * 10) / 10));

  // Determine Priority Category
  let priorityLevel = 'P4';
  if (finalScore >= 85) {
    priorityLevel = 'P1';
  } else if (finalScore >= 65) {
    priorityLevel = 'P2';
  } else if (finalScore >= 35) {
    priorityLevel = 'P3';
  } else {
    priorityLevel = 'P4';
  }

  return {
    priority_level: priorityLevel,
    priority_score: finalScore,
    contributing_factors: factors,
    explanation: `Assigned ${priorityLevel} priority (Score: ${finalScore}/100) based on ${factors.length} clinical indicators.`
  };
}

/**
 * Reconciles Automated System Risk with Doctor Clinical Assessment.
 * Preserves both values, enforces hard safety constraints, and determines effective operational priority.
 */
export function reconcileRiskAndPriority({
  systemRisk = 'LOW',
  doctorAssessedRisk = 'LOW',
  clinicalStatus = 'STABLE',
  systemPriority = 'NOT_ASSESSED',
  priorityScore = null,
  source = 'DOCTOR_ASSESSMENT'
}) {
  const riskRank = { LOW: 1, MODERATE: 2, HIGH: 3, CRITICAL: 4 };

  const sysRank = riskRank[systemRisk] || 1;
  const docRank = riskRank[doctorAssessedRisk] || 1;

  let reconciliationStatus = 'MATCH';
  let effectiveRisk = doctorAssessedRisk;
  let reconciliationNotes = '';

  // 1. Safety-Critical Rule when triggered by automated system observations:
  // If an automated monitor reports CRITICAL physiological crash (sysRank 4) after doctor assessed lower
  if (source === 'SYSTEM_OBSERVATION' && sysRank === 4 && docRank < 4) {
    reconciliationStatus = 'REVIEW_REQUIRED';
    effectiveRisk = 'CRITICAL';
    reconciliationNotes = `Automated system observation detected CRITICAL physiological impairment. Clinical assessment differs (${doctorAssessedRisk}). High-acuity safety protocol active. Review required.`;
  }
  // 2. Doctor Assessment Evaluation:
  else if (docRank > sysRank) {
    reconciliationStatus = 'DOCTOR_ELEVATED';
    effectiveRisk = doctorAssessedRisk;
    reconciliationNotes = `Attending physician elevated clinical risk assessment from ${systemRisk} to ${doctorAssessedRisk} (${clinicalStatus}).`;
  } else if (docRank < sysRank) {
    reconciliationStatus = 'DOCTOR_DEESCALATED';
    effectiveRisk = doctorAssessedRisk;
    reconciliationNotes = `Attending physician de-escalated clinical risk from ${systemRisk} to ${doctorAssessedRisk} based on clinical response (${clinicalStatus}).`;
  } else {
    reconciliationStatus = 'MATCH';
    effectiveRisk = doctorAssessedRisk;
    reconciliationNotes = `System automated risk estimate (${systemRisk}) and doctor clinical assessment (${doctorAssessedRisk}) are aligned.`;
  }

  // Determine operational priority level:
  // If systemPriority was calculated from prioritization rules (e.g. calculatePriority), respect the policy calculation!
  let effectivePriority = systemPriority && systemPriority !== 'NOT_ASSESSED' ? systemPriority : null;
  let effectiveScore = priorityScore !== null && priorityScore !== undefined ? priorityScore : null;

  // If priority was not pre-calculated, map based on effective risk:
  if (!effectivePriority) {
    switch (effectiveRisk) {
      case 'CRITICAL':
        effectivePriority = 'P1';
        effectiveScore = 95.0;
        break;
      case 'HIGH':
        effectivePriority = 'P2';
        effectiveScore = 75.0;
        break;
      case 'MODERATE':
        effectivePriority = 'P3';
        effectiveScore = 50.0;
        break;
      case 'LOW':
      default:
        effectivePriority = 'P4';
        effectiveScore = 25.0;
        break;
    }
  }

  // If safety-critical review is required due to automated crash observation, ensure priority remains P1
  if (reconciliationStatus === 'REVIEW_REQUIRED') {
    effectivePriority = 'P1';
    effectiveScore = Math.max(85.0, effectiveScore || 85.0);
  }

  return {
    effective_risk: effectiveRisk,
    effective_priority: effectivePriority,
    priority_score: effectiveScore,
    reconciliation_status: reconciliationStatus,
    reconciliation_notes: reconciliationNotes,
    doctor_assessed_risk: doctorAssessedRisk,
    system_calculated_risk: systemRisk,
    clinical_status: clinicalStatus
  };
}
