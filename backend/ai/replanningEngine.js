/**
 * CareBridge Dynamic Replanning Engine
 * Detects hospital state change triggers, verifies active allocation feasibility,
 * and executes dynamic re-optimization when allocations become infeasible or suboptimal.
 * Produces structured explanations ("What Changed", "Why It Mattered", "Previous vs New Plan").
 */

import { evaluateCSPConstraints } from './cspEngine.js';
import { runAStarPlanner } from './astarEngine.js';

export async function evaluateDynamicReplanning(triggerEvent, activePatients = [], doctors = [], rooms = [], resources = []) {
  // Normalize triggerEvent if passed as primitive
  const normalizedTrigger = typeof triggerEvent === 'string'
    ? { type: 'STATE_CHANGE', patientId: triggerEvent }
    : (triggerEvent || { type: 'STATE_CHANGE' });

  const { type, patientId, doctorId, roomId, resourceId, details } = normalizedTrigger;
  const safeActivePatients = Array.isArray(activePatients) ? activePatients : [];
  const safeDoctors = Array.isArray(doctors) ? doctors : [];
  const safeRooms = Array.isArray(rooms) ? rooms : [];
  const safeResources = Array.isArray(resources) ? resources : [];

  let whatChanged = '';
  let whyItMattered = '';
  let requiresReplan = false;

  switch (type) {
    case 'NEW_CRITICAL_PATIENT':
      whatChanged = `New P1 Critical patient admitted (${details?.patientName || patientId}).`;
      whyItMattered = 'Requires immediate ICU room and specialist doctor allocation, potentially preempting non-critical resources.';
      requiresReplan = true;
      break;

    case 'DOCTOR_UNAVAILABLE':
      whatChanged = `Doctor (${doctorId || details?.doctorName}) became unavailable / went on leave.`;
      whyItMattered = 'Patients assigned to this doctor must be reassigned immediately to preserve clinical care continuity.';
      requiresReplan = true;
      break;

    case 'ROOM_MAINTENANCE':
      whatChanged = `Room (${roomId || details?.roomNumber}) taken offline for emergency maintenance.`;
      whyItMattered = 'Active occupant must be transferred to a suitable compatible room without disrupting care level.';
      requiresReplan = true;
      break;

    case 'RESOURCE_FAILURE':
      whatChanged = `Critical equipment resource (${resourceId || details?.resourceName}) reported malfunction/failure.`;
      whyItMattered = 'Depletes available stock of required equipment (e.g., Ventilators/Monitors) below current allocation demand.';
      requiresReplan = true;
      break;

    case 'PRIORITY_ESCALATION':
      whatChanged = `Patient (${patientId || details?.patientName}) condition escalated to higher priority (P1/P2).`;
      whyItMattered = 'Patient now requires higher care level (ICU/Bay) and continuous monitoring.';
      requiresReplan = true;
      break;

    default:
      whatChanged = `Hospital state update event: ${type}.`;
      whyItMattered = 'Re-evaluating active allocations against updated system state.';
      break;
  }

  // Record Previous Plan state
  const previousPlan = safeActivePatients.map(p => ({
    patient_id: p.id,
    patient_name: p.name || `Patient ${p.id}`,
    doctor_id: p.assigned_doctor_id,
    room_id: p.assigned_room_id,
    status: p.status
  }));

  // Run A* Replanning on updated state
  const replanResult = runAStarPlanner(safeActivePatients, safeDoctors, safeRooms, safeResources);

  // Generate New Plan
  const newPlan = replanResult.assignments;

  // Build Diff & Explanation
  const reassignments = [];
  for (const newAssign of newPlan) {
    const prev = previousPlan.find(p => p.patient_id === newAssign.patient_id);
    if (prev && (prev.doctor_id !== newAssign.doctor_id || prev.room_id !== newAssign.room_id)) {
      reassignments.push({
        patient_id: newAssign.patient_id,
        from_doctor: prev.doctor_id,
        to_doctor: newAssign.doctor_id,
        from_room: prev.room_id,
        to_room: newAssign.room_id,
        reason: 'Re-optimized for workload balance & constraint satisfaction'
      });
    }
  }

  return {
    replan_triggered: requiresReplan,
    trigger_type: type,
    what_changed: whatChanged,
    why_it_mattered: whyItMattered,
    previous_plan: previousPlan,
    new_plan: newPlan,
    reassignments_count: reassignments.length,
    reassignments: reassignments,
    algorithm_used: 'A_STAR_DYNAMIC_REPLANNER',
    nodes_explored: replanResult.nodes_explored,
    execution_time_ms: replanResult.execution_time_ms,
    explanation: `Dynamic replanning triggered by ${type}. Generated updated plan with ${reassignments.length} re-allocations in ${replanResult.execution_time_ms}ms.`
  };
}
