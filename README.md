# CareBridge 2.0 🏥⚡

> **Human-Centered Emergency Care & Classical AI Decision Support System**

CareBridge 2.0 is an enterprise-grade, human-centered emergency department management platform. It combines classical Artificial Intelligence (Constraint Satisfaction, A* State-Space Search, Dynamic Replanning), Machine Learning risk prediction models, and discrete-event simulation with a real-time clinical workflow engine to optimize patient triage, bed allocation, and emergency resource management.

---

## 🌟 Key Features & Highlights

- **🧠 Multi-Algorithm AI Decision Support**: Combines rule-based clinical triage, Constraint Satisfaction (CSP), A* search pathfinding, and dynamic replanning to make transparent, optimal patient-resource allocation suggestions.
- **🩺 Continuous Clinical Reassessment**: Automates risk transitions based on real-time physiological vitals (SpO2, Heart Rate, Blood Pressure, Consciousness) and logs immutable clinical observation history.
- **👩‍⚕️ Role-Based Adaptive Workspaces**: Tailored interfaces for **Doctors** (clinical queue & treatment), **Receptionists** (fast intake & triage), and **Administrators** (resource management & system benchmarks).
- **⚡ Real-Time Server-Sent Events (SSE)**: Streams live audit events, vital alerts, and system-wide state changes across all connected client workspaces without client polling.
- **📊 Algorithmic Benchmarking & Simulation Lab**: Built-in discrete-event simulator and comparative engine benchmarking CareBridge Hybrid Optimizer against Greedy, FCFS, and Round-Robin allocation strategies.
- **🔒 Enterprise Security & Auditability**: PBKDF2 password hashing, JWT authentication with fine-grained role claims, and full SQLite audit logging (`audit_logs`, `observation_history`, `risk_history`).

---

## 🏗️ System Architecture & AI Engine Suite

CareBridge's decision pipeline is powered by 9 modular backend AI engines (`backend/ai/`):

```
                       ┌──────────────────────────────┐
                       │  Patient Intake / Vitals     │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │   1. Priority & Triage       │
                       │     (priorityEngine.js)      │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │ 2. Resource Requirements     │
                       │   (requirementEngine.js)     │
                       └──────────────┬───────────────┘
                                      │
       ┌──────────────────────────────┴──────────────────────────────┐
       ▼                                                             ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│  3. Constraint Satisfaction  │              │    4. A* Search Planner      │
│         (cspEngine.js)       │              │      (astarEngine.js)        │
└──────────────┬───────────────┘              └──────────────┬───────────────┘
               │                                             │
               └──────────────────────┬──────────────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │   5. Dynamic Replanning      │
                       │    (replanningEngine.js)     │
                       └──────────────┬───────────────┘
                                      │
       ┌──────────────────────────────┼──────────────────────────────┐
       ▼                              ▼                              ▼
┌──────────────────────────────┐┌──────────────────────────────┐┌──────────────────────────────┐
│  6. ML Risk Predictor        ││  7. Benchmark Engine         ││ 8. Simulation Lab            │
│       (mlEngine.js)          ││    (benchmarkEngine.js)      ││    (simulationEngine.js)     │
└──────────────────────────────┘└──────────────────────────────┘└──────────────────────────────┘
                                      ▲
                                      │
                       ┌──────────────────────────────┐
                       │  9. Observation Engine       │
                       │    (observationEngine.js)    │
                       └──────────────────────────────┘
```

### AI Engines Overview

1. **Priority Engine (`priorityEngine.js`)**: Evaluates vitals and emergency category to assign priority levels (`P1 Critical`, `P2 Urgent`, `P3 Non-Urgent`, `P4 Minor`) along with human-readable contributing factors.
2. **Requirement Engine (`requirementEngine.js`)**: Maps clinical symptoms and priority levels to required doctor specialties, room types (ICU, Trauma, General Bed), and medical devices.
3. **CSP Engine (`cspEngine.js`)**: Enforces hard constraints (specialty match, capacity limit, non-conflict) and soft constraints (doctor load balancing, bed utilization efficiency).
4. **A* Planner Engine (`astarEngine.js`)**: Executes state-space search over candidate assignment graphs to compute globally optimal patient-to-resource routing paths.
5. **Replanning Engine (`replanningEngine.js`)**: Automatically detects high-priority patient arrivals or sudden deterioration, triggering real-time re-allocation.
6. **ML Engine (`mlEngine.js`)**: Features predictive ML models (Random Forest, Decision Tree, Logistic Regression) to assess patient deterioration risk.
7. **Benchmark Engine (`benchmarkEngine.js`)**: Evaluates allocation performance metrics (wait times, resource utilization, constraint satisfaction) against baseline scheduling algorithms.
8. **Simulation Engine (`simulationEngine.js`)**: Runs discrete-event hospital workload scenarios (High-Emergency Surge, Shortage Stress Test) for capacity planning.
9. **Observation Engine (`observationEngine.js`)**: Processes incoming clinical vitals, records immutable observation history, and manages dynamic risk transitions.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React 18, Vite, Custom CSS (Glassmorphism, Dark Mode Theme Engine) |
| **Backend** | Node.js, Express.js, Server-Sent Events (SSE) |
| **Database** | SQLite3 (`backend/database/carebridge.sqlite`) |
| **Security & Auth** | Node Crypto (PBKDF2 with unique salts), JSON Web Tokens (JWT) |
| **Testing** | Built-in Node.js Automated Integration & AI Test Suite |

---

## 📁 Directory Structure

```
AI PROJECT/
├── backend/
│   ├── ai/                      # Classical AI & ML Engines
│   │   ├── astarEngine.js       # A* Search Planner
│   │   ├── benchmarkEngine.js   # Algorithm Comparison Engine
│   │   ├── cspEngine.js         # Constraint Satisfaction Solver
│   │   ├── mlEngine.js          # Machine Learning Risk Models
│   │   ├── observationEngine.js # Vital Reassessment & Risk History
│   │   ├── priorityEngine.js    # Clinical Triage Logic
│   │   ├── replanningEngine.js  # Dynamic Replanning Trigger
│   │   ├── requirementEngine.js # Clinical Requirement Mapping
│   │   └── simulationEngine.js  # Discrete-Event Simulator
│   ├── database/
│   │   ├── db.js                # SQLite Async Wrapper
│   │   ├── schema.sql           # Database Schema (Tables & Triggers)
│   │   └── seed.js              # Production Seed Data Generator
│   ├── tests/
│   │   └── test_suite.js        # Master Integrated Test Suite
│   ├── auth.js                  # Authentication & Password Hashing
│   └── server.js                # Express Server & SSE Middleware
├── src/
│   ├── components/              # Shared Components (Header, Sidebar, PatientModal)
│   ├── pages/                   # Main Page Wrappers
│   ├── views/                   # 12 Specialized Administrative & Clinical Views
│   ├── workspaces/              # Role-Based Workspaces (Doctor, Reception, Admin)
│   ├── App.jsx                  # Main Application Component & State Management
│   └── index.css                # Custom CSS Design System
├── index.html                   # Entry HTML Document
├── package.json                 # Project Manifest & NPM Scripts
├── vite.config.js               # Vite Configuration
└── README.md                    # Project Documentation
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher

### 1. Installation

Clone the repository and install all dependencies:

```bash
# Navigate to the project root directory
cd "path/to/AI PROJECT"

# Install NPM dependencies
npm install
```

### 2. Database Initialization & Seeding

Initialize the SQLite database and seed demo data (doctors, rooms, resources, sample patients):

```bash
npm run db:legacy-seed
```

### 3. Running the Application

You can start the backend API server and frontend development environment:

#### Start Backend Server
```bash
npm start
```
*Runs Express backend server on [http://localhost:3001](http://localhost:3001).*

#### Start Frontend Development Server (in a separate terminal)
```bash
npm run dev
```
*Runs Vite dev server on [http://localhost:5173](http://localhost:5173).*

#### Production Build & Serving
To compile the frontend static bundle and serve it directly via the backend server:

```bash
npm run build
npm start
```

---

## 🧪 Running Automated Tests

CareBridge includes a comprehensive master test suite covering database transactions, JWT authentication, triage logic, CSP constraints, A* routing, dynamic replanning, ML model execution, algorithm benchmarking, discrete-event simulation, and resource discharge handling.

Run the test suite via:

```bash
npm test
```

**Expected Test Output**:
```
====================================================
CAREBRIDGE 2.0 MASTER PRODUCTION BUILD TEST SUITE
====================================================

[1/10] Testing Authentication & JWT Module...
  ✓ PASS: PBKDF2 password hashing & verification operates correctly.
  ✓ PASS: JWT token generation & role claim verification verified.

[2/10] Testing Priority & Triage Engine...
  ✓ PASS: Unresponsive cardiac hypoxia correctly classified as P1 Critical.
  ...
====================================================
TEST SUMMARY: 18 Passed, 0 Failed.
====================================================
```

---

## 📡 API Endpoints Summary

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/auth/login` | `POST` | Authenticate user credentials and return JWT token. |
| `/api/auth/me` | `GET` | Retrieve logged-in user profile & role permissions. |
| `/api/patients` | `GET`, `POST` | Fetch all active patients or register a new emergency patient. |
| `/api/patients/:id/observations` | `POST` | Record clinical observation vitals & evaluate risk transition. |
| `/api/ai/recommend-assignment` | `POST` | Run CSP + A* planner for AI-driven patient resource allocation. |
| `/api/ai/benchmark` | `POST` | Execute benchmark comparing CareBridge Hybrid vs. Greedy/FCFS. |
| `/api/ai/simulation` | `POST` | Run discrete-event ER workload simulation. |
| `/api/audit-logs` | `GET` | Retrieve immutable system event logs. |
| `/api/stream/events` | `GET` | SSE stream connection for real-time live events. |

---

## 👥 System Accounts & Login Credentials

All pre-configured user accounts (including Doctor IDs `DOC-101` through `DOC-105`, Reception, and Admin accounts) are documented in detail in [LOGIN_CREDENTIALS.md](file:///f:/AI%20PROJECT/LOGIN_CREDENTIALS.md).

- **Doctor Workspace**: `DOC-101` (`doctor@carebridge.local`) / `doctor123`
- **Reception Workspace**: `reception@carebridge.local` / `reception123`
- **Admin Workspace**: `admin@carebridge.local` / `admin123`

---

## 📄 License

This project is developed as part of the CareBridge Emergency Care System. Licensed under the MIT License.
