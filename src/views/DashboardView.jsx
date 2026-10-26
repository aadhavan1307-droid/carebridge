import React from 'react';

export default function DashboardView({ stats, patients = [], decisions = [], conflicts = [], dischargeRequests = [], onSelectPatient, onNavigateView }) {
  const pStats = stats?.patients || {};
  const rStats = stats?.rooms || {};
  const sStats = stats?.staff || {};
  const resStats = stats?.resources || {};
  const aStats = stats?.ai || {};
  const dwStats = stats?.discharge_workflow || {};

  const pendingDischarges = (Array.isArray(dischargeRequests) ? dischargeRequests : []).filter(dr => dr.status === 'PENDING');
  const safePatients = Array.isArray(patients) ? patients : (patients?.patients || patients?.data || []);
  const activePatients = safePatients.filter(p => p.status !== 'DISCHARGED');

  const riskBadgeColor = (risk) => {
    const colors = { CRITICAL: '#ef4444', HIGH: '#f59e0b', MODERATE: '#3b82f6', LOW: '#10b981' };
    return colors[risk] || '#6b7280';
  };

  const priorityBadgeColor = (p) => {
    const colors = { P1: '#ef4444', P2: '#f59e0b', P3: '#3b82f6', P4: '#10b981', NOT_ASSESSED: '#6b7280' };
    return colors[p] || '#6b7280';
  };

  return (
    <div>
      {/* Header Title & Subtitle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', letterSpacing: '0.5px' }}>HOSPITAL OPERATIONS COMMAND CENTER</h1>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Real-Time Emergency Care Coordination & Intelligent Resource Monitoring
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem' }} onClick={() => onNavigateView('patients')}>
            🏥 View Patients
          </button>
          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem' }} onClick={() => onNavigateView('ai-center')}>
            🧠 AI Decisions
          </button>
          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem' }} onClick={() => onNavigateView('alerts')}>
            ⚠️ Active Alerts ({conflicts.length})
          </button>
          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem' }} onClick={() => onNavigateView('resources')}>
            📦 Resources
          </button>
        </div>
      </div>

      {/* Critical Conflicts Banner */}
      {conflicts?.length > 0 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '8px',
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <div>
              <strong style={{ color: '#f87171', fontSize: '0.95rem' }}>
                {conflicts.length} Active Operational Bottleneck{conflicts.length > 1 ? 's' : ''} Detected
              </strong>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {conflicts[0]?.description || 'Resource allocation constraint triggered.'}
              </div>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => onNavigateView('alerts')}>
            Resolve Conflicts
          </button>
        </div>
      )}

      {/* Pending Discharge Requests Banner */}
      {pendingDischarges.length > 0 && (
        <div style={{
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.35)',
          borderRadius: '8px',
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.4rem' }}>📤</span>
            <div>
              <strong style={{ color: '#fbbf24', fontSize: '0.92rem' }}>
                {pendingDischarges.length} Discharge Request{pendingDischarges.length > 1 ? 's' : ''} Awaiting Administrative Completion
              </strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Doctor-initiated discharge requests pending receptionist administrative checklist review.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid Metrics KPI Cards (Live DB Driven) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {/* Active Patients */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Patients</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-cyan)', marginTop: '2px' }}>{pStats.total_active || 0}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {pStats.unallocated || 0} Unallocated / Waiting
          </div>
        </div>

        {/* Critical Risk */}
        <div className="card" style={{ padding: '14px 16px', borderLeft: '3px solid #ef4444' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Critical Patients</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444', marginTop: '2px' }}>{pStats.critical || 0}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Continuous Monitoring Required
          </div>
        </div>

        {/* High Risk */}
        <div className="card" style={{ padding: '14px 16px', borderLeft: '3px solid #f59e0b' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>High-Risk Patients</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b', marginTop: '2px' }}>{pStats.high || 0}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Frequent Reassessment
          </div>
        </div>

        {/* Waiting / Unallocated */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unallocated Patients</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ec4899', marginTop: '2px' }}>{pStats.unallocated || 0}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Doctor or Room Unassigned
          </div>
        </div>

        {/* Available Doctors */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Available Doctors</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-emerald)', marginTop: '2px' }}>
            {sStats.available || 0} / {sStats.total || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {sStats.at_capacity || 0} At Capacity
          </div>
        </div>

        {/* Bed Capacity */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Available Beds</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-cyan)', marginTop: '2px' }}>
            {rStats.available_beds || 0} / {rStats.total_beds || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Occupancy: {rStats.occupancy_pct || 0}%
          </div>
        </div>

        {/* ICU Capacity */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ICU Beds</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: rStats.icu?.configured ? '#3b82f6' : '#6b7280', marginTop: '4px' }}>
            {rStats.icu?.formatted || 'NOT CONFIGURED'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {rStats.icu?.configured ? `${rStats.icu?.occupied_beds} Occupied` : 'No ICU beds found'}
          </div>
        </div>

        {/* Resource Utilization */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Resource Utilization</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fbbf24', marginTop: '2px' }}>
            {resStats.utilization_pct || 0}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {resStats.available || 0} Available Units
          </div>
        </div>
      </div>

      {/* Two Column Layout: Active Patients Table + AI Decision Stream */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '24px' }}>
        {/* Left: Active Patients Overview */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3>Active Patients Overview</h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Live database records of active hospital admissions
              </div>
            </div>
            <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => onNavigateView('patients')}>
              View All Patients
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Patient</th>
                  <th>Category</th>
                  <th>Risk</th>
                  <th>Priority</th>
                  <th>Doctor</th>
                  <th>Room</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activePatients && activePatients.length > 0 ? (
                  activePatients.slice(0, 8).map((p) => {
                    const priority = p.operational_priority_level ?? 'NOT_ASSESSED';
                    const risk = p.clinical_risk_level || 'LOW';

                    return (
                      <tr key={p.id}>
                        <td className="mono" style={{ fontSize: '0.82rem', color: 'var(--accent-cyan)' }}>{p.id}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.age} y/o / {p.gender}</div>
                        </td>
                        <td><strong style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>{p.emergency_category}</strong></td>
                        <td>
                          <span style={{
                            padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700,
                            background: `${riskBadgeColor(risk)}22`, color: riskBadgeColor(risk), border: `1px solid ${riskBadgeColor(risk)}55`
                          }}>
                            {risk}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700,
                            background: `${priorityBadgeColor(priority)}22`, color: priorityBadgeColor(priority)
                          }}>
                            {priority}
                          </span>
                        </td>
                        <td>{p.doctor_name || p.assigned_doctor_name || p.assigned_doctor_id || <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>UNASSIGNED</span>}</td>
                        <td>{p.room_number || p.assigned_room_number || p.assigned_room_id || <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>UNASSIGNED</span>}</td>
                        <td>
                          <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>{p.status}</span>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                            onClick={() => onSelectPatient(p)}
                          >
                            🔍 Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      No active patient admissions recorded in database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Real-Time AI Decision Stream */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3>AI Decision Stream</h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Automated optimization & triage decision log</div>
            </div>
            <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', background: 'rgba(6,182,212,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
              {aStats.total_decisions || 0} Total
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '480px', overflowY: 'auto' }}>
            {decisions && decisions.length > 0 ? (
              decisions.slice(0, 7).map((d) => (
                <div key={d.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>{d.algorithm_used}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      {new Date(d.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {d.decision_type}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
                    {d.explanation_text}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px dashed var(--border-color)' }}>
                No recent AI decisions logged in database.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
