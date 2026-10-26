import React from 'react';

export default function PatientModal({ patient, onClose, dischargeRequests = [], activeRole }) {
  if (!patient) return null;

  const priorityVal = patient.operational_priority_level ?? 'NOT_ASSESSED';
  const priorityClass = priorityVal !== 'NOT_ASSESSED' ? `badge-${priorityVal.toLowerCase()}` : 'badge-not_assessed';
  const patientDischargeRequest = dischargeRequests.find(dr => dr.patient_id === patient.id);

  const statusColor = (status) => {
    const colors = { PENDING: '#fbbf24', APPROVED: '#10b981', REJECTED: '#ef4444', CANCELLED: '#6b7280', DISCHARGE_REQUESTED: '#fbbf24' };
    return colors[status] || '#6b7280';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2>{patient.name}</h2>
              <span className={`badge ${priorityClass}`}>{priorityVal} CRITICALITY</span>
              <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: `${statusColor(patient.status)}22`, color: statusColor(patient.status) }}>
                {patient.status}
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Patient ID: <span className="mono">{patient.id}</span> | Age: {patient.age} | Gender: {patient.gender} | Category: <strong style={{ color: 'var(--accent-cyan)' }}>{patient.emergency_category}</strong>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
        </div>

        {/* Content Tabs / Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          {/* Clinical Vitals & Measurements */}
          <div className="card" style={{ padding: '16px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)', marginBottom: '12px' }}>🩺 Clinical Vitals & Triage</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Heart Rate:</span>{' '}
                <strong className="mono">{patient.vitals?.hr !== undefined ? `${patient.vitals.hr} bpm` : 'NOT_ASSESSED'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Blood Pressure:</span>{' '}
                <strong className="mono">
                  {patient.vitals?.bp_sys !== undefined ? `${patient.vitals.bp_sys}/${patient.vitals.bp_dia} mmHg` : 'NOT_ASSESSED'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>SpO2 Saturation:</span>{' '}
                <strong className="mono">{patient.vitals?.spo2 !== undefined ? `${patient.vitals.spo2}%` : 'NOT_ASSESSED'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Consciousness:</span>{' '}
                <strong style={{ color: 'var(--accent-amber)' }}>{patient.consciousness_state || 'ALERT'}</strong>
              </div>
            </div>

            <div style={{ marginTop: '14px', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Symptoms:</span>
              <div style={{ marginTop: '4px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {patient.symptoms?.length > 0 ? (
                  patient.symptoms.map((s, idx) => (
                    <span key={idx} style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem' }}>
                      {s}
                    </span>
                  ))
                ) : (
                  <span style={{ color: 'var(--text-dim)' }}>None reported</span>
                )}
              </div>
            </div>
          </div>

          {/* Priorities & Contributing Factors */}
          <div className="card" style={{ padding: '16px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-amber)', marginBottom: '12px' }}>⚖️ Priority Score Factors</h4>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
              Score: {patient.priority_score || 0} / 100
            </div>
            <ul style={{ paddingLeft: '16px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              {patient.factors?.length > 0 ? (
                patient.factors.map((f, idx) => <li key={idx}>{f}</li>)
              ) : (
                <li>Standard emergency baseline score evaluation</li>
              )}
            </ul>
          </div>
        </div>

        {/* Assigned Doctor & Room */}
        <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)', marginBottom: '12px' }}>🏥 Active Care Assignment</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Assigned Doctor:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                {patient.doctor_name || patient.assignment?.doctor_name || patient.assigned_doctor_id || 'AWAITING_ASSIGNMENT'}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Assigned Room:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                {patient.room_number || patient.assignment?.room_number || patient.assigned_room_id || 'AWAITING_ASSIGNMENT'}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Required Specialty:</span>
              <div style={{ fontWeight: 600, color: 'var(--accent-cyan)', marginTop: '2px' }}>
                {patient.requirements?.specialty || 'GENERAL'}
              </div>
            </div>
          </div>
        </div>

        {/* AI Decision Explanation */}
        {patient.aiDecisions?.length > 0 && (
          <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-purple)', marginBottom: '8px' }}>🤖 AI Decision Rationale</h4>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Algorithm: <strong className="mono" style={{ color: 'var(--accent-cyan)' }}>{patient.aiDecisions[0].algorithm_used}</strong>
            </div>
            <div className="trajectory-box">
              {patient.aiDecisions[0].explanation_text}
            </div>
          </div>
        )}

        {/* Discharge Workflow Status */}
        {patient.status === 'DISCHARGE_REQUESTED' && patientDischargeRequest ? (
          <div style={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.25)', padding: '16px', borderRadius: '8px' }}>
            <h4 style={{ fontSize: '0.9rem', color: '#fbbf24', marginBottom: '10px' }}>⏳ Discharge Request Pending</h4>
            <div style={{ fontSize: '0.85rem', lineHeight: '1.7', color: 'var(--text-main)' }}>
              <div><strong>Request ID:</strong> <span className="mono" style={{ color: 'var(--accent-cyan)' }}>{patientDischargeRequest.id}</span></div>
              <div><strong>Requesting Doctor:</strong> <span style={{ color: 'var(--accent-emerald)' }}>{patientDischargeRequest.requesting_doctor_name}</span></div>
              <div><strong>Clinical Assessment:</strong> {patientDischargeRequest.clinical_assessment}</div>
              <div><strong>Final Condition:</strong> <span style={{ fontWeight: 600 }}>{patientDischargeRequest.final_condition}</span></div>
              <div><strong>Created:</strong> {new Date(patientDischargeRequest.created_at).toLocaleString()}</div>
            </div>
            <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '6px', fontSize: '0.82rem', color: '#fbbf24', textAlign: 'center' }}>
              ⏳ Awaiting Receptionist review and administrative discharge completion
            </div>
          </div>
        ) : patient.status === 'DISCHARGED' ? (
          <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '14px', borderRadius: '8px', fontSize: '0.85rem' }}>
            <strong style={{ color: '#34d399' }}>✓ Discharged:</strong> Patient was discharged on <span className="mono">{patient.discharge?.discharged_at || 'Recently'}</span>.
            {patient.discharge?.clinical_summary && <> Summary: {patient.discharge.clinical_summary}</>}
          </div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--accent-cyan)' }}>Discharge Workflow:</strong> The attending Doctor must create a clinical discharge request. The Receptionist then reviews and completes the administrative discharge.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
