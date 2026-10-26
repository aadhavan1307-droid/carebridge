/**
 * CareBridge Requirement Identification Engine
 * Derives patient care requirements (Specialty, Care Level, Room Type, Monitoring, Equipment)
 * from priority analysis and clinical symptoms.
 */

export function deriveRequirements(patientData, priorityResult) {
  const { emergency_category = 'GENERAL', symptoms = [] } = patientData;
  const { priority_level = 'P4' } = priorityResult;

  let specialty = 'GENERAL';
  let careLevel = 'LOW';
  let roomType = 'GENERAL_WARD';
  let monitoringLevel = 'STANDARD';
  let requiredEquipment = [];
  let staffRequirement = 'STANDARD';
  let isolationRequired = false;

  const symptomText = Array.isArray(symptoms) ? symptoms.join(' ').toLowerCase() : String(symptoms).toLowerCase();

  // Specialty Mapping
  switch (emergency_category.toUpperCase()) {
    case 'CARDIAC':
      specialty = 'CARDIOLOGY';
      break;
    case 'TRAUMA':
      specialty = 'TRAUMA';
      break;
    case 'NEURO':
      specialty = 'NEUROLOGY';
      break;
    case 'RESPIRATORY':
      specialty = 'PULMONOLOGY';
      break;
    default:
      if (symptomText.includes('fracture') || symptomText.includes('sprain')) {
        specialty = 'ORTHOPEDICS';
      } else if (symptomText.includes('child') || symptomText.includes('pediatric')) {
        specialty = 'PEDIATRICS';
      } else {
        specialty = 'EMERGENCY';
      }
      break;
  }

  // Priority-based Care Level, Room Type, and Monitoring Mapping
  if (priority_level === 'P1') {
    careLevel = 'CRITICAL';
    roomType = 'ICU';
    monitoringLevel = 'CONTINUOUS';
    staffRequirement = 'SPECIALIST';
    requiredEquipment.push('CARDIAC_MONITOR', 'INFUSION_PUMP');
    if (emergency_category === 'RESPIRATORY' || symptomText.includes('hypoxia') || symptomText.includes('unresponsive')) {
      requiredEquipment.push('VENTILATOR');
    }
  } else if (priority_level === 'P2') {
    careLevel = 'HIGH';
    roomType = 'EMERGENCY_BAY';
    monitoringLevel = 'CONTINUOUS';
    staffRequirement = 'SENIOR_DOCTOR';
    requiredEquipment.push('CARDIAC_MONITOR');
    if (symptomText.includes('asthma') || symptomText.includes('wheezing')) {
      requiredEquipment.push('INFUSION_PUMP');
    }
  } else if (priority_level === 'P3') {
    careLevel = 'MODERATE';
    roomType = 'EMERGENCY_BAY';
    monitoringLevel = 'INTERMITTENT';
    staffRequirement = 'STANDARD';
  } else {
    careLevel = 'LOW';
    roomType = 'GENERAL_WARD';
    monitoringLevel = 'STANDARD';
    staffRequirement = 'STANDARD';
  }

  // Surgery / Operating Room Requirement
  if (symptomText.includes('internal bleeding') || symptomText.includes('compound fracture') || symptomText.includes('surgery')) {
    roomType = 'OPERATING_ROOM';
    careLevel = 'CRITICAL';
    staffRequirement = 'SPECIALIST';
  }

  // Isolation requirement check
  if (symptomText.includes('covid') || symptomText.includes('tuberculosis') || symptomText.includes('infection')) {
    isolationRequired = true;
  }

  // Remove duplicate equipment
  requiredEquipment = Array.from(new Set(requiredEquipment));

  return {
    specialty,
    care_level: careLevel,
    room_type: roomType,
    monitoring_level: monitoringLevel,
    required_equipment: requiredEquipment,
    staff_requirement: staffRequirement,
    isolation_required: isolationRequired,
    explanation: `Patient identified as requiring ${specialty} specialty, ${roomType} room (${careLevel} care), with ${monitoringLevel} monitoring and equipment: [${requiredEquipment.join(', ') || 'Standard'}].`
  };
}
