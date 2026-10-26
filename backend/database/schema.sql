-- CareBridge 2.0 Relational Database Schema (SQLite)
-- NOTE: Tables use CREATE TABLE IF NOT EXISTS to preserve data across restarts.
-- To wipe and reseed data, use the admin /api/admin/reseed endpoint.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- RECEPTIONIST, DOCTOR, ADMINISTRATOR
  specialty TEXT, -- For doctors
  doctor_id TEXT, -- References doctors(id)
  token_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

CREATE TABLE IF NOT EXISTS doctors (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  department TEXT DEFAULT 'Emergency Medicine',
  qualification TEXT DEFAULT 'MD',
  contact TEXT DEFAULT '+1-555-0199',
  shift TEXT DEFAULT '08:00 - 20:00',
  experience_years INTEGER NOT NULL DEFAULT 10,
  availability_status TEXT NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, BUSY, AT_CAPACITY, OFF_SHIFT, UNAVAILABLE
  current_load INTEGER NOT NULL DEFAULT 0,
  max_capacity INTEGER NOT NULL DEFAULT 8,
  account_status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS care_team_assignments (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  encounter_id TEXT,
  doctor_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'PRIMARY', -- PRIMARY, CONSULTANT, COVERING, CARE_TEAM
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, RELEASED, CANCELLED
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  room_number TEXT NOT NULL UNIQUE,
  room_type TEXT NOT NULL, -- ICU, EMERGENCY_BAY, OPERATING_ROOM, GENERAL_WARD
  care_level TEXT NOT NULL, -- CRITICAL, HIGH, MODERATE, LOW
  capacity INTEGER NOT NULL DEFAULT 1,
  current_occupancy INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, OCCUPIED, MAINTENANCE
  equipment_json TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  resource_type TEXT NOT NULL, -- VENTILATOR, CARDIAC_MONITOR, DEFIBRILLATOR, INFUSION_PUMP, PORTABLE_XRAY
  total_count INTEGER NOT NULL DEFAULT 10,
  allocated_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OPERATIONAL', -- OPERATIONAL, LIMITED, MAINTENANCE
  location_zone TEXT DEFAULT 'Main Storage',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT NOT NULL,
  contact TEXT,
  emergency_category TEXT NOT NULL, -- CARDIAC, TRAUMA, NEURO, RESPIRATORY, GENERAL
  admission_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  admission_source TEXT DEFAULT 'Walk-in',
  consciousness_state TEXT NOT NULL DEFAULT 'ALERT',
  clinical_risk_level TEXT DEFAULT 'LOW', -- LOW, MODERATE, HIGH, CRITICAL
  doctor_assessed_risk TEXT,
  system_calculated_risk TEXT,
  clinical_status TEXT DEFAULT 'STABLE', -- STABLE, IMPROVING, DETERIORATING, DISCHARGE READY
  risk_reconciliation_status TEXT DEFAULT 'MATCH', -- MATCH, REVIEW_REQUIRED, DOCTOR_ELEVATED
  operational_priority_level TEXT DEFAULT 'NOT_ASSESSED', -- P1 (Critical), P2 (High), P3 (Moderate), P4 (Low), NOT_ASSESSED
  priority_score REAL DEFAULT 0.0,
  assigned_doctor_id TEXT,
  assigned_room_id TEXT,
  status TEXT NOT NULL DEFAULT 'ADMITTED', -- ADMITTED, TRIAGED, ALLOCATION_PENDING, NO_FEASIBLE_ALLOCATION, ALLOCATED, UNDER_CARE, REASSESSMENT, DISCHARGE_REQUESTED, DISCHARGE_READY, DISCHARGED
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_doctor_id) REFERENCES doctors(id),
  FOREIGN KEY (assigned_room_id) REFERENCES rooms(id)
);

CREATE TABLE IF NOT EXISTS encounters (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ADMITTED',
  admitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  discharged_at DATETIME,
  admission_notes TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS clinical_risk_assessments (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  encounter_id TEXT,
  doctor_id TEXT NOT NULL,
  doctor_name TEXT,
  previous_risk TEXT,
  assessed_risk TEXT NOT NULL, -- LOW, MODERATE, HIGH, CRITICAL
  clinical_status TEXT NOT NULL, -- STABLE, IMPROVING, DETERIORATING, DISCHARGE READY
  reason TEXT NOT NULL,
  clinical_notes TEXT,
  supporting_observations TEXT,
  resulting_priority TEXT,
  reconciliation_status TEXT DEFAULT 'MATCH',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

CREATE TABLE IF NOT EXISTS observation_history (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  encounter_id TEXT,
  observation_type TEXT NOT NULL, -- HR, BP_SYS, BP_DIA, SPO2, RESP_RATE, TEMP, CONSCIOUSNESS, SYMPTOM
  value TEXT NOT NULL, -- Numeric string or controlled NOT_ASSESSED
  unit TEXT,
  notes TEXT,
  recorded_by TEXT DEFAULT 'SYSTEM',
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS risk_history (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  previous_risk TEXT,
  new_risk TEXT NOT NULL,
  contributing_factors_json TEXT DEFAULT '[]',
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS priority_history (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  previous_priority TEXT,
  new_priority TEXT NOT NULL,
  priority_score REAL NOT NULL,
  reason TEXT NOT NULL,
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS patient_requirements (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  specialty TEXT NOT NULL,
  care_level TEXT NOT NULL,
  room_type TEXT NOT NULL,
  monitoring_level TEXT NOT NULL, -- CONTINUOUS, INTERMITTENT, STANDARD
  required_equipment_json TEXT DEFAULT '[]',
  staff_requirement TEXT DEFAULT 'STANDARD',
  isolation_required INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  doctor_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  resources_allocated_json TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, REPLANNED, CANCELLED
  score REAL DEFAULT 0.0,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  released_at DATETIME,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE IF NOT EXISTS resource_allocations (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  assignment_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  allocated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  released_at DATETIME,
  FOREIGN KEY (resource_id) REFERENCES resources(id),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (assignment_id) REFERENCES assignments(id)
);

CREATE TABLE IF NOT EXISTS ai_decisions (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  decision_type TEXT NOT NULL, -- CARE_ALLOCATION, DYNAMIC_REPLANNING, PRIORITY_TRIAGE, CONTINUOUS_REASSESSMENT
  algorithm_used TEXT NOT NULL, -- A_STAR, CSP, RULE_BASED, WEIGHTED_OPTIMIZER, HYBRID
  score_cost REAL DEFAULT 0.0,
  decision_data_json TEXT NOT NULL,
  explanation_text TEXT NOT NULL,
  alternative_evaluations_json TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS conflicts (
  id TEXT PRIMARY KEY,
  severity TEXT NOT NULL, -- CRITICAL, WARNING, INFO
  conflict_type TEXT NOT NULL, -- NO_ICU_AVAILABLE, DOCTOR_OVERLOAD, EQUIPMENT_SHORTAGE, INCOMPATIBLE_ASSIGNMENT
  description TEXT NOT NULL,
  patient_ids_json TEXT DEFAULT '[]',
  resource_ids_json TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, RESOLVED, DISMISSED
  detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  resolution_notes TEXT
);

CREATE TABLE IF NOT EXISTS discharge_requests (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  requesting_doctor_id TEXT NOT NULL,
  requesting_doctor_name TEXT NOT NULL,
  clinical_assessment TEXT NOT NULL,
  final_condition TEXT NOT NULL DEFAULT 'STABLE', -- STABLE, IMPROVED, GUARDED, FAIR
  discharge_instructions TEXT DEFAULT '',
  follow_up_required INTEGER DEFAULT 0,
  follow_up_notes TEXT DEFAULT '',
  vitals_at_request_json TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, CANCELLED, RETURNED_FOR_CLARIFICATION
  rejection_reason TEXT,
  clarification_reason TEXT,
  reviewed_by TEXT,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (requesting_doctor_id) REFERENCES doctors(id)
);

CREATE TABLE IF NOT EXISTS discharges (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  discharge_request_id TEXT,
  discharged_by_doctor TEXT NOT NULL DEFAULT 'Dr. System',
  completed_by_receptionist TEXT NOT NULL DEFAULT 'Reception',
  clinical_summary TEXT NOT NULL,
  administrative_notes TEXT DEFAULT '',
  vitals_at_discharge_json TEXT DEFAULT '{}',
  length_of_stay_hours REAL DEFAULT 0.0,
  discharged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (discharge_request_id) REFERENCES discharge_requests(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_role TEXT NOT NULL DEFAULT 'SYSTEM',
  actor_id TEXT,
  payload_json TEXT DEFAULT '{}',
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);
CREATE INDEX IF NOT EXISTS idx_patients_priority ON patients(operational_priority_level);
CREATE INDEX IF NOT EXISTS idx_obs_patient ON observation_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_risk_patient ON risk_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_priority_patient ON priority_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON doctors(specialty);
CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(room_type);
CREATE INDEX IF NOT EXISTS idx_discharge_requests_status ON discharge_requests(status);
CREATE INDEX IF NOT EXISTS idx_discharge_requests_patient ON discharge_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_risk_patient ON clinical_risk_assessments(patient_id);
