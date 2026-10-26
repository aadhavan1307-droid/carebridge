/**
 * CareBridge A* State-Space Search Planner Engine
 * Performs graph search over hospital allocation state space to find optimal low-cost feasible care allocations.
 * Computes g(n) accumulated cost, h(n) admissible heuristic, and f(n) = g(n) + h(n).
 */

import { evaluateCSPConstraints, scoreCandidatePair } from './cspEngine.js';

export class PriorityQueue {
  constructor() {
    this.elements = [];
  }

  enqueue(item, priority) {
    this.elements.push({ item, priority });
    this.elements.sort((a, b) => a.priority - b.priority); // Min-heap (lowest cost first)
  }

  dequeue() {
    return this.elements.shift()?.item;
  }

  isEmpty() {
    return this.elements.length === 0;
  }
}

export function runAStarPlanner(patients = [], doctors = [], rooms = [], resources = [], options = {}) {
  const startTime = Date.now();
  const maxNodes = options.maxNodes || 500;

  // Filter patients needing assignment
  const unassigned = patients.filter(p => p.status === 'AWAITING_ASSIGNMENT' || p.status === 'ACTIVE');

  if (unassigned.length === 0) {
    return {
      status: 'NO_PATIENTS_TO_ASSIGN',
      assignments: [],
      cost: 0,
      nodes_explored: 0,
      execution_time_ms: Date.now() - startTime,
      explanation: 'No active patients currently awaiting assignment.'
    };
  }

  // Initial State S0
  const initialState = {
    unassignedPatients: unassigned,
    doctorLoads: doctors.reduce((acc, d) => ({ ...acc, [d.id]: d.current_load }), {}),
    roomOccupancies: rooms.reduce((acc, r) => ({ ...acc, [r.id]: r.current_occupancy }), {}),
    assignments: [],
    g: 0,
    h: calculateAdmissibleHeuristic(unassigned, doctors, rooms),
    trajectory: []
  };

  initialState.f = initialState.g + initialState.h;

  const openSet = new PriorityQueue();
  openSet.enqueue(initialState, initialState.f);

  let nodesExplored = 0;
  let bestSolutionState = null;

  while (!openSet.isEmpty() && nodesExplored < maxNodes) {
    nodesExplored++;
    const currentState = openSet.dequeue();

    // Goal Check: All patients assigned
    if (currentState.unassignedPatients.length === 0) {
      bestSolutionState = currentState;
      break;
    }

    // Pick next highest priority patient from unassigned list
    const [currentPatient, ...remainingPatients] = currentState.unassignedPatients;
    const requirements = currentPatient.requirements || {
      specialty: currentPatient.emergency_category || 'GENERAL',
      care_level: currentPatient.priority_level === 'P1' ? 'CRITICAL' : 'HIGH',
      room_type: currentPatient.priority_level === 'P1' ? 'ICU' : 'EMERGENCY_BAY',
      required_equipment: []
    };

    // Filter available doctors & rooms based on current state
    const availableDocs = doctors.filter(d => (currentState.doctorLoads[d.id] || 0) < d.max_capacity);
    const availableRooms = rooms.filter(r => (currentState.roomOccupancies[r.id] || 0) < r.capacity);

    const csp = evaluateCSPConstraints(currentPatient, requirements, availableDocs, availableRooms, resources);

    if (csp.status !== 'FEASIBLE') {
      // If infeasible, record penalty state and continue
      const penaltyState = {
        unassignedPatients: remainingPatients,
        doctorLoads: { ...currentState.doctorLoads },
        roomOccupancies: { ...currentState.roomOccupancies },
        assignments: [...currentState.assignments, { patient_id: currentPatient.id, unassigned_reason: 'No CSP feasible Doctor/Room' }],
        g: currentState.g + 500, // Heavy penalty for unassigned patient
        h: calculateAdmissibleHeuristic(remainingPatients, doctors, rooms),
        trajectory: [...currentState.trajectory, `Patient ${currentPatient.id} unassigned (No CSP match)`]
      };
      penaltyState.f = penaltyState.g + penaltyState.h;
      openSet.enqueue(penaltyState, penaltyState.f);
      continue;
    }

    // Generate action transitions for top eligible Doctor-Room pairs
    for (const doc of csp.valid_doctors.slice(0, 3)) {
      for (const room of csp.valid_rooms.slice(0, 3)) {
        const candidateScore = scoreCandidatePair(currentPatient, requirements, doc, room, doctors);
        const actionCost = Math.max(1, 150 - candidateScore);

        // Priority urgency multiplier: P1 gets lower cost for fast allocation
        const urgencyMult = currentPatient.priority_level === 'P1' ? 0.5 : 1.0;
        const stepCost = actionCost * urgencyMult;

        const nextDoctorLoads = { ...currentState.doctorLoads, [doc.id]: (currentState.doctorLoads[doc.id] || 0) + 1 };
        const nextRoomOccupancies = { ...currentState.roomOccupancies, [room.id]: (currentState.roomOccupancies[room.id] || 0) + 1 };

        const newAssignment = {
          patient_id: currentPatient.id,
          doctor_id: doc.id,
          doctor_name: doc.name,
          room_id: room.id,
          room_number: room.room_number,
          score: candidateScore,
          cost: stepCost
        };

        const nextState = {
          unassignedPatients: remainingPatients,
          doctorLoads: nextDoctorLoads,
          roomOccupancies: nextRoomOccupancies,
          assignments: [...currentState.assignments, newAssignment],
          g: currentState.g + stepCost,
          h: calculateAdmissibleHeuristic(remainingPatients, doctors, rooms),
          trajectory: [...currentState.trajectory, `Assigned ${currentPatient.id} -> ${doc.name} in ${room.room_number} (cost: ${stepCost.toFixed(1)})`]
        };

        nextState.f = nextState.g + nextState.h;

        // Keep best partial state in case maxNodes reached before total goal
        if (!bestSolutionState || nextState.assignments.length > bestSolutionState.assignments.length) {
          bestSolutionState = nextState;
        }

        openSet.enqueue(nextState, nextState.f);
      }
    }
  }

  const executionTimeMs = Date.now() - startTime;

  return {
    status: bestSolutionState ? 'SUCCESS' : 'SEARCH_FAILED',
    assignments: bestSolutionState?.assignments || [],
    cost: bestSolutionState?.g || 0,
    heuristic_h: bestSolutionState?.h || 0,
    total_f: bestSolutionState?.f || 0,
    nodes_explored: nodesExplored,
    trajectory: bestSolutionState?.trajectory || [],
    execution_time_ms: executionTimeMs,
    explanation: `A* state-space search explored ${nodesExplored} nodes in ${executionTimeMs}ms. Optimal path total cost f(n) = ${bestSolutionState?.f.toFixed(1) || 0} (g=${bestSolutionState?.g.toFixed(1) || 0}, h=${bestSolutionState?.h.toFixed(1) || 0}).`
  };
}

/**
 * Admissible Heuristic Estimate h(n)
 * Sum of minimum lower-bound assignment cost for remaining unassigned patients
 */
function calculateAdmissibleHeuristic(remainingPatients, doctors, rooms) {
  let heuristicSum = 0;
  for (const patient of remainingPatients) {
    // Admissible optimistic lower bound cost based on priority
    if (patient.priority_level === 'P1') heuristicSum += 10;
    else if (patient.priority_level === 'P2') heuristicSum += 15;
    else if (patient.priority_level === 'P3') heuristicSum += 20;
    else heuristicSum += 25;
  }
  return heuristicSum;
}
