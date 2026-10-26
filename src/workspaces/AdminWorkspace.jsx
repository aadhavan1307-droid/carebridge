import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import PatientDetailModal from '../components/PatientDetailModal';

import DashboardView from '../views/DashboardView';
import PatientsView from '../views/PatientsView';
import DoctorsView from '../views/DoctorsView';
import RoomsView from '../views/RoomsView';
import ResourcesView from '../views/ResourcesView';
import AIDecisionCenterView from '../views/AIDecisionCenterView';
import AlertsConflictsView from '../views/AlertsConflictsView';
import AnalyticsView from '../views/AnalyticsView';
import AuditHistoryView from '../views/AuditHistoryView';
import AdministrationView from '../views/AdministrationView';
import SettingsView from '../views/SettingsView';

export default function AdminWorkspace({
  user,
  token,
  stats,
  patients,
  doctors,
  rooms,
  resources,
  decisions,
  conflicts,
  dischargeRequests = [],
  sseConnected,
  onAdmitPatient,
  onApproveDischarge,
  onRejectDischarge,
  onReplan,
  onRefresh,
  onLogout
}) {
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedPatient, setSelectedPatient] = useState(null);

  const pendingDischarges = dischargeRequests.filter(dr => dr.status === 'PENDING');

  const counts = {
    patients: patients.filter(p => p.status !== 'DISCHARGED').length,
    doctors: doctors.length,
    rooms: rooms.length,
    aiDecisions: decisions.length,
    conflicts: conflicts.filter(c => c.status === 'ACTIVE').length,
    pendingDischarges: pendingDischarges.length
  };

  return (
    <div className="app-container">
      <Sidebar activeView={activeView} setActiveView={setActiveView} counts={counts} />

      <div className="main-content">
        <header className="header">
          <div>
            <h2 style={{ fontSize: '1.05rem', letterSpacing: '0.5px' }}>CAREBRIDGE 2.0 | HOSPITAL OPERATIONS COMMAND CENTER</h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Logged in as: <strong style={{ color: 'var(--accent-purple)' }}>{user.name}</strong> (Administrator)
              {pendingDischarges.length > 0 && (
                <span style={{ marginLeft: '12px', color: '#fbbf24', fontWeight: 600 }}>
                  ⚠️ {pendingDischarges.length} pending discharge request{pendingDischarges.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onLogout}>Logout</button>
        </header>

        <main className="view-container">
          {activeView === 'dashboard' && (
            <DashboardView
              stats={stats}
              patients={patients}
              decisions={decisions}
              conflicts={conflicts.filter(c => c.status === 'ACTIVE')}
              dischargeRequests={dischargeRequests}
              onSelectPatient={setSelectedPatient}
              onNavigateView={setActiveView}
            />
          )}

          {activeView === 'patients' && (
            <PatientsView
              patients={patients}
              onSelectPatient={setSelectedPatient}
              onAdmitPatient={onAdmitPatient}
              onRefresh={onRefresh}
            />
          )}

          {activeView === 'doctors' && <DoctorsView doctors={doctors} />}

          {activeView === 'rooms' && <RoomsView rooms={rooms} />}

          {activeView === 'resources' && <ResourcesView resources={resources} />}

          {activeView === 'ai-center' && (
            <AIDecisionCenterView decisions={decisions} onReplan={onReplan} />
          )}

          {activeView === 'alerts' && (
            <AlertsConflictsView conflicts={conflicts} onReplan={onReplan} />
          )}

          {activeView === 'analytics' && <AnalyticsView />}

          {activeView === 'audit' && <AuditHistoryView />}

          {activeView === 'admin' && <AdministrationView />}

          {activeView === 'settings' && (
            <SettingsView user={user} />
          )}
        </main>
      </div>

      {selectedPatient && (
        <PatientDetailModal
          patientId={typeof selectedPatient === 'object' ? (selectedPatient.id || selectedPatient.patient_id) : selectedPatient}
          token={token}
          onClose={() => setSelectedPatient(null)}
          userRole={user?.role || 'ADMINISTRATOR'}
        />
      )}
    </div>
  );
}
