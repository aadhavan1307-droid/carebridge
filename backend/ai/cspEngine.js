/**
 * CareBridge Constraint Satisfaction Problem (CSP) Engine
 * Formulates and enforces hard and soft constraints over hospital allocation states.
 */

export function evaluateCSPConstraints(patient, requirements, doctors = [], rooms = [], resources = []) {
  const violations = [];

  // Filter Doctors satisfying Hard Constraints
  const validDoctors = doctors.filter(doc => {
    // Hard Constraint 1: Doctor must be active / available or not over capacity
    if (doc.availability_status === 'ON_LEAVE') {
      violations.push(`Doctor ${doc.name} (${doc.id}) excluded: Currently ON_LEAVE.`);
      return false;
    }

    if (doc.current_load >= doc.max_capacity) {
      violations.push(`Doctor ${doc.name} (${doc.id}) excluded: Reached max capacity (${doc.current_load}/${doc.max_capacity}).`);
      return false;
    }

    // Hard Constraint 2: Specialty Compatibility
    // Allow EMERGENCY or INTENSIVE_CARE doctors as fallback for high/critical priorities
    const docSpec = String(doc.specialty || '').toUpperCase();
    const reqSpec = String(requirements.specialty || '').toUpperCase();
    const specialtyMatches =
      docSpec === reqSpec ||
      docSpec.includes('EMERGENCY') ||
      (docSpec.includes('INTENSIVE') && requirements.care_level === 'CRITICAL');

    if (!specialtyMatches) {
      return false; // Silently filter out incompatible specialty
    }

    return true;
  });

  // Filter Rooms satisfying Hard Constraints
  const validRooms = rooms.filter(room => {
    // Hard Constraint 3: Room Status
    if (room.status === 'MAINTENANCE') {
      violations.push(`Room ${room.room_number} (${room.id}) excluded: Under MAINTENANCE.`);
      return false;
    }

    // Hard Constraint 4: Capacity Limit
    if (room.current_occupancy >= room.capacity) {
      return false; // Silently filter full rooms
    }

    // Hard Constraint 5: Room Care Level capability
    const careLevels = { LOW: 1, MODERATE: 2, HIGH: 3, CRITICAL: 4 };
    const roomCareVal = careLevels[room.care_level] || 1;
    const reqCareVal = careLevels[requirements.care_level] || 1;

    if (roomCareVal < reqCareVal) {
      violations.push(`Room ${room.room_number} care level (${room.care_level}) insufficient for required care (${requirements.care_level}).`);
      return false;
    }

    return true;
  });

  // Check Equipment Stock Availability
  const missingEquipment = [];
  const requiredEquip = requirements.required_equipment || [];

  for (const equipType of requiredEquip) {
    const res = resources.find(r => r.resource_type === equipType);
    if (!res || (res.total_count - res.allocated_count) < 1) {
      missingEquipment.push(equipType);
      violations.push(`Required equipment resource '${equipType}' has no remaining unallocated inventory.`);
    }
  }

  const isFeasible = validDoctors.length > 0 && validRooms.length > 0 && missingEquipment.length === 0;

  return {
    status: isFeasible ? 'FEASIBLE' : 'NO_FEASIBLE_SOLUTION',
    valid_doctors_count: validDoctors.length,
    valid_rooms_count: validRooms.length,
    valid_doctors: validDoctors,
    valid_rooms: validRooms,
    missing_equipment: missingEquipment,
    violations: violations,
    explanation: isFeasible
      ? `Feasible CSP solution exists with ${validDoctors.length} eligible doctors and ${validRooms.length} eligible rooms.`
      : `NO FEASIBLE SOLUTION: ${violations.slice(0, 3).join(' ')}`
  };
}

/**
 * Score Doctor-Room Candidate Pair (Soft Objectives)
 */
export function scoreCandidatePair(patient, requirements, doctor, room, allDoctors = []) {
  let score = 100; // Base score

  // 1. Specialty Exact Match (+25 bonus)
  if (doctor.specialty === requirements.specialty) {
    score += 25;
  } else if (doctor.specialty === 'EMERGENCY') {
    score += 10;
  }

  // 2. Doctor Workload Balance Penalty (-15 per current active patient)
  const loadPct = doctor.current_load / Math.max(1, doctor.max_capacity);
  score -= Math.round(loadPct * 30);

  // 3. Room Type Match Bonus
  if (room.room_type === requirements.room_type) {
    score += 20;
  } else if (room.room_type === 'ICU' && requirements.care_level === 'CRITICAL') {
    score += 15;
  }

  // 4. Experience vs Priority Alignment
  if (patient.priority_level === 'P1' && doctor.experience_years >= 12) {
    score += 15; // Expert doctor for critical patient
  }

  return Math.max(0, Math.round(score * 10) / 10);
}
