import React, { useState, useEffect } from 'react';

export default function PatientDetailModal({ patientId, token, onClose, userRole }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPatientDetail = async () => {
    if (!patientId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to retrieve patient details.');
      }
      setData(result);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Unable to load patient record.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientDetail();
  }, [patientId]);

  if (!patientId) return null;

  const riskColor = (level) => {
    const colors = { CRITICAL: '#ef4444', HIGH: '#f59e0b', MODERATE: '#3b82f6', LOW: '#10b981' };
    return colors[level] || '#6b7280';
  };

  const priorityColor = (priority) => {
    const colors = { P1: '#ef4444', P2: '#f59e0b', P3: '#3b82f6', P4: '#10b981' };
    return colors[priority] || '#6b7280';
  };

  const statusColor = (status) => {
    const colors = {
      ADMITTED: '#3b82f6',
      UNDER_CARE: '#10b981',
      DISCHARGE_REQUESTED: '#fbbf24',
      RETURNED_FOR_CLARIFICATION: '#ec4899',
      DISCHARGED: '#6b7280'
    };
    return colors[status] || '#6b7280';
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-card, #111827)', border: '1px solid var(--border-color, #374151)',
        borderRadius: '12px', width: '100%', maxWidth: '850px', maxHeight: '90vh',
        overflowY: 'auto', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border-color, #374151)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
              CAREBRIDGE 2.0 | {data?.patient?.status === 'DISCHARGED' ? 'ARCHIVED DISCHARGE RECORD' : 'PATIENT OPERATIONAL RECORD'}
            </div>
            <h2 style={{ fontSize: '1.3rem', marginTop: '2px', color: 'var(--text-main)' }}>
              {data?.patient ? data.patient.name : `Patient ID: ${patientId}`}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '4px' }}>
              🔒 READ-ONLY ACCESS ({userRole || 'RECEPTIONIST'})
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)',
                padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem'
              }}
            >
              ✖ Close
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', flex: 1 }}>
          {/* Loading State */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '1.1rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                ⏳ Loading patient record...
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Fetching database record for ID: <span className="mono">{patientId}</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #f87171', color: '#f87171', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '6px' }}>
                ⚠️ Unable to load patient record.
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                {error}
              </div>
              <button
                className="btn btn-primary"
                onClick={fetchPatientDetail}
                style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer' }}
              >
                🔄 RETRY
              </button>
            </div>
          )}

          {/* Data Loaded */}
          {data && !loading && (
            <div>
              {/* Demographics & Operational Overview */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>PATIENT DEMOGRAPHICS</div>
                  <div style={{ fontSize: '0.9rem', marginTop: '8px', lineHeight: '1.7' }}>
                    <div><strong>ID:</strong> <span className="mono" style={{ color: 'var(--accent-cyan)' }}>{data.patient.id}</span></div>
                    <div><strong>Age / Gender:</strong> {data.patient.age} yrs / {data.patient.gender}</div>
                    <div><strong>Contact:</strong> {data.patient.contact || 'N/A'}</div>
                    <div><strong>Category:</strong> <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{data.patient.emergency_category}</span></div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>ADMISSION & ENCOUNTER</div>
                  <div style={{ fontSize: '0.9rem', marginTop: '8px', lineHeight: '1.7' }}>
                    <div><strong>Encounter ID:</strong> <span className="mono">{data.encounter?.id || `ENC-${data.patient.id}`}</span></div>
                    <div><strong>Status:</strong> <span style={{ color: statusColor(data.patient.status), fontWeight: 700 }}>{data.patient.status}</span></div>
                    <div><strong>Admitted At:</strong> {data.patient.admission_time ? new Date(data.patient.admission_time).toLocaleString() : 'N/A'}</div>
                    <div><strong>Consciousness:</strong> {data.patient.consciousness_state || 'ALERT'}</div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>CURRENT RISK & PRIORITY</div>
                  <div style={{ fontSize: '0.9rem', marginTop: '8px', lineHeight: '1.7' }}>
                    <div>
                      <strong>Effective Risk:</strong>{' '}
                      <span style={{ color: riskColor(data.currentRisk.effective_risk), fontWeight: 700 }}>
                        {data.currentRisk.effective_risk}
                      </span>
                    </div>
                    <div>
                      <strong>Priority Level:</strong>{' '}
                      <span style={{ color: priorityColor(data.currentPriority.operational_priority_level), fontWeight: 700 }}>
                        {data.currentPriority.operational_priority_level}
                      </span> ({data.currentPriority.priority_score}/100)
                    </div>
                    <div><strong>Doctor Risk:</strong> {data.currentRisk.doctor_assessed_risk}</div>
                    <div><strong>System Risk:</strong> {data.currentRisk.system_calculated_risk}</div>
                  </div>
                </div>
              </div>

              {/* Assignment Details */}
              <div style={{ background: 'rgba(6, 182, 212, 0.04)', border: '1px solid rgba(6, 182, 212, 0.2)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem', marginBottom: '10px', textTransform: 'uppercase' }}>
                  🏥 Resource & Care Allocations
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', fontSize: '0.88rem' }}>
                  <div>
                    <strong>Assigned Doctor:</strong><br/>
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
                      {data.doctor ? `${data.doctor.name} (${data.doctor.specialty})` : 'None / Released'}
                    </span>
                  </div>
                  <div>
                    <strong>Assigned Room:</strong><br/>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                      {data.room ? `${data.room.room_number} (${data.room.room_type || 'Ward'})` : 'None / Released'}
                    </span>
                  </div>
                  <div>
                    <strong>Allocated Equipment:</strong><br/>
                    <span style={{ color: 'var(--text-main)' }}>
                      {data.requirements?.required_equipment_json ? JSON.parse(data.requirements.required_equipment_json).join(', ') : 'Standard Equipment'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Discharge Request Information (if present) */}
              {data.discharge_request && (
                <div style={{ background: 'rgba(251, 191, 36, 0.05)', border: '1px solid rgba(251, 191, 36, 0.3)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                  <h4 style={{ color: '#fbbf24', fontSize: '0.9rem', marginBottom: '8px' }}>
                    📋 Discharge Request Metadata (Doctor Initiated)
                  </h4>
                  <div style={{ fontSize: '0.88rem', lineHeight: '1.7' }}>
                    <div><strong>Requesting Doctor:</strong> {data.discharge_request.requesting_doctor_name}</div>
                    <div><strong>Request Status:</strong> <strong style={{ color: '#fbbf24' }}>{data.discharge_request.status}</strong></div>
                    <div><strong>Clinical Assessment:</strong> {data.discharge_request.clinical_assessment}</div>
                    <div><strong>Final Clinical Condition:</strong> <span style={{ color: '#10b981', fontWeight: 600 }}>{data.discharge_request.final_condition}</span></div>
                    {data.discharge_request.discharge_instructions && <div><strong>Discharge Instructions:</strong> {data.discharge_request.discharge_instructions}</div>}
                    {data.discharge_request.follow_up_notes && <div><strong>Follow-up Notes:</strong> {data.discharge_request.follow_up_notes}</div>}
                    {data.discharge_request.clarification_reason && <div style={{ color: '#ec4899' }}><strong>Reason Returned for Clarification:</strong> {data.discharge_request.clarification_reason}</div>}
                  </div>
                </div>
              )}

              {/* Discharge Summary (if DISCHARGED) */}
              {data.discharge && (
                <div style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                  <h4 style={{ color: 'var(--accent-emerald)', fontSize: '0.9rem', marginBottom: '8px' }}>
                    📜 Final Discharge Record & Administrative Notes
                  </h4>
                  <div style={{ fontSize: '0.88rem', lineHeight: '1.7' }}>
                    <div><strong>Discharged At:</strong> {new Date(data.discharge.discharged_at).toLocaleString()}</div>
                    <div><strong>Discharged By (Doctor):</strong> {data.discharge.discharged_by_doctor}</div>
                    <div><strong>Completed By (Receptionist):</strong> {data.discharge.completed_by_receptionist}</div>
                    <div><strong>Length of Stay:</strong> <span className="mono">{data.discharge.length_of_stay_hours || 14.5} hours</span></div>
                    <div><strong>Clinical Summary:</strong> {data.discharge.clinical_summary}</div>
                    {data.discharge.administrative_notes && <div><strong>Administrative Notes:</strong> {data.discharge.administrative_notes}</div>}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <h4 style={{ color: 'var(--accent-purple)', fontSize: '0.9rem', marginBottom: '12px' }}>
                  📜 Patient Care Timeline & History Log (Read-Only)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                  {data.history?.clinical_assessments?.map(ca => (
                    <div key={ca.id} style={{ background: 'rgba(16, 185, 129, 0.06)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem' }}>
                      👨‍⚕️ <strong>{ca.doctor_name || 'Doctor'}</strong> assessed risk as <strong style={{ color: riskColor(ca.assessed_risk) }}>{ca.assessed_risk}</strong> ({ca.clinical_status}): "{ca.reason}"
                      <span style={{ float: 'right', color: 'var(--text-dim)', fontSize: '0.72rem' }}>{new Date(ca.created_at).toLocaleTimeString()}</span>
                    </div>
                  ))}

                  {data.history?.risk_history?.map(rh => (
                    <div key={rh.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem' }}>
                      ⚡ System Risk Transition: <strong style={{ color: riskColor(rh.new_risk) }}>{rh.previous_risk} → {rh.new_risk}</strong>
                      <span style={{ float: 'right', color: 'var(--text-dim)', fontSize: '0.72rem' }}>{new Date(rh.calculated_at).toLocaleTimeString()}</span>
                    </div>
                  ))}

                  {data.history?.observations?.map(obs => (
                    <div key={obs.id} style={{ background: 'rgba(255,255,255,0.01)', padding: '6px 12px', borderRadius: '4px', fontSize: '0.78rem' }}>
                      🩺 Observation <strong>{obs.observation_type}</strong>: <span className="mono">{obs.value} {obs.unit || ''}</span> (by {obs.recorded_by})
                      <span style={{ float: 'right', color: 'var(--text-dim)', fontSize: '0.72rem' }}>{new Date(obs.recorded_at).toLocaleTimeString()}</span>
                    </div>
                  ))}

                  {(!data.history?.observations?.length && !data.history?.risk_history?.length && !data.history?.clinical_assessments?.length) && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '12px' }}>
                      No prior observation or risk history entries recorded.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
