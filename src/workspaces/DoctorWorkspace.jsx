import React, { useState, useEffect } from 'react';

export default function DoctorWorkspace({
  user,
  token,
  patients,
  dischargeRequests = [],
  onCreateDischargeRequest,
  onCancelDischargeRequest,
  onResubmitDischarge,
  onRefresh,
  onLogout
}) {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState({ observations: [], risk_history: [], priority_history: [] });
  const [activePanel, setActivePanel] = useState('observations'); // observations, discharge

  // Clinical Observation Form
  const [obsForm, setObsForm] = useState({
    hr: '', bp_sys: '', bp_dia: '', spo2: '', resp_rate: '', temp: '',
    consciousness: 'ALERT', symptom: ''
  });
  const [isSubmittingObs, setIsSubmittingObs] = useState(false);
  const [reassessmentFeedback, setReassessmentFeedback] = useState(null);
  const [reassessmentError, setReassessmentError] = useState('');

  // Discharge Request Form
  const [dischargeForm, setDischargeForm] = useState({
    clinical_assessment: '',
    final_condition: 'STABLE',
    discharge_instructions: '',
    follow_up_required: false,
    follow_up_notes: ''
  });
  const [isSubmittingDischarge, setIsSubmittingDischarge] = useState(false);
  const [dischargeFeedback, setDischargeFeedback] = useState(null);
  const [dischargeError, setDischargeError] = useState('');

  // Doctor Clinical Risk Assessment Form
  const [riskForm, setRiskForm] = useState({
    assessed_risk: 'HIGH',
    clinical_status: 'STABLE',
    reason: '',
    clinical_notes: '',
    supporting_observations: ''
  });
  const [isSubmittingRisk, setIsSubmittingRisk] = useState(false);
  const [riskFeedback, setRiskFeedback] = useState(null);
  const [riskError, setRiskError] = useState('');

  const [doctorProfile, setDoctorProfile] = useState(null);
  const [workloadInfo, setWorkloadInfo] = useState(null);
  const [myPatients, setMyPatients] = useState([]);

  // Fetch Patient Detail by ID
  const fetchPatientDetail = async (patientId) => {
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const p = data.patient || data;
        if (p && p.id) {
          setSelectedPatient(p);
        }
      }
    } catch (err) {
      console.error('Failed to fetch patient detail:', err);
    }
  };

  // Fetch Personalized Doctor Data
  const fetchDoctorData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [pRes, wRes, profRes] = await Promise.all([
        fetch('/api/doctors/me/patients', { headers }).then(r => r.ok ? r.json() : null),
        fetch('/api/doctors/me/workload', { headers }).then(r => r.ok ? r.json() : null),
        fetch('/api/doctors/me', { headers }).then(r => r.ok ? r.json() : null)
      ]);
      if (pRes && Array.isArray(pRes.patients)) setMyPatients(pRes.patients);
      if (wRes) setWorkloadInfo(wRes);
      if (profRes && profRes.doctor) setDoctorProfile(profRes.doctor);
    } catch (err) {
      console.error('Failed to fetch personalized doctor data:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDoctorData();
    }
  }, [token, patients]);

  // Keep selectedPatient state synchronized when myPatients or patients is refreshed
  useEffect(() => {
    if (selectedPatient) {
      const allP = [...(myPatients || []), ...(patients || [])];
      const latest = allP.find(p => p.id === selectedPatient.id);
      if (latest && (
        latest.clinical_risk_level !== selectedPatient.clinical_risk_level ||
        latest.doctor_assessed_risk !== selectedPatient.doctor_assessed_risk ||
        latest.system_calculated_risk !== selectedPatient.system_calculated_risk ||
        latest.operational_priority_level !== selectedPatient.operational_priority_level ||
        latest.risk_reconciliation_status !== selectedPatient.risk_reconciliation_status ||
        latest.status !== selectedPatient.status
      )) {
        setSelectedPatient(latest);
      }
    }
  }, [myPatients, patients]);

  const [accessDeniedError, setAccessDeniedError] = useState(null);

  // Fetch Patient History
  const fetchPatientHistory = async (patientId) => {
    try {
      setAccessDeniedError(null);
      const res = await fetch(`/api/patients/${patientId}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 403) {
        setAccessDeniedError(`403 Access Denied: Doctor is not authorized to access patient '${patientId}'.`);
        setPatientHistory({ observations: [], risk_history: [], priority_history: [] });
        return;
      }
      const data = await res.json();
      setPatientHistory(data);
    } catch (err) {
      console.error(err);
    }
  };

  const initialMyPatients = (patients || []).filter(p =>
    (p.assigned_doctor_id === (user?.doctor_id || user?.id) || p.assigned_doctor_name === user?.name) &&
    p.status !== 'DISCHARGED'
  );
  const assignedPatients = (myPatients && myPatients.length > 0) ? myPatients : initialMyPatients;
  const pendingRequests = dischargeRequests.filter(dr => dr.status === 'PENDING');
  const activeDischargeRequest = selectedPatient
    ? dischargeRequests.find(dr => dr.patient_id === selectedPatient.id && (dr.status === 'PENDING' || dr.status === 'RETURNED_FOR_CLARIFICATION'))
    : null;

  const prevPatientIdRef = React.useRef(null);

  useEffect(() => {
    if (selectedPatient) {
      const isNewPatient = prevPatientIdRef.current !== selectedPatient.id;
      prevPatientIdRef.current = selectedPatient.id;

      fetchPatientHistory(selectedPatient.id);

      if (isNewPatient) {
        setReassessmentFeedback(null);
        setReassessmentError('');
        setDischargeFeedback(null);
        setDischargeError('');
        setRiskFeedback(null);
        setRiskError('');
        setRiskForm({
          assessed_risk: selectedPatient.doctor_assessed_risk || selectedPatient.clinical_risk_level || 'LOW',
          clinical_status: selectedPatient.clinical_status || 'STABLE',
          reason: '',
          clinical_notes: '',
          supporting_observations: ''
        });

        if (activeDischargeRequest && activeDischargeRequest.status === 'RETURNED_FOR_CLARIFICATION') {
          setDischargeForm({
            clinical_assessment: activeDischargeRequest.clinical_assessment || '',
            final_condition: activeDischargeRequest.final_condition || 'STABLE',
            discharge_instructions: activeDischargeRequest.discharge_instructions || '',
            follow_up_required: !!activeDischargeRequest.follow_up_required,
            follow_up_notes: activeDischargeRequest.follow_up_notes || ''
          });
        } else {
          setDischargeForm({ clinical_assessment: '', final_condition: 'STABLE', discharge_instructions: '', follow_up_required: false, follow_up_notes: '' });
        }

        setActivePanel('observations');
      }
    }
  }, [selectedPatient?.id]);

  const savedRisk = selectedPatient ? (selectedPatient.doctor_assessed_risk || selectedPatient.clinical_risk_level || 'LOW') : 'LOW';
  const hasUnsavedRiskDraft = Boolean(
    selectedPatient && (
      riskForm.assessed_risk !== savedRisk ||
      (riskForm.reason && riskForm.reason.trim().length > 0)
    )
  );

  const handleDiscardRiskDraft = () => {
    if (!selectedPatient) return;
    setRiskForm({
      assessed_risk: selectedPatient.doctor_assessed_risk || selectedPatient.clinical_risk_level || 'LOW',
      clinical_status: selectedPatient.clinical_status || 'STABLE',
      reason: '',
      clinical_notes: '',
      supporting_observations: ''
    });
    setRiskError('');
  };

  const handleSaveRiskAssessment = async (e) => {
    e.preventDefault();
    if (!selectedPatient) return;
    if (!riskForm.reason.trim()) {
      setRiskError('Clinical reason is mandatory for submitting a risk assessment change.');
      return;
    }
    // Frontend status-risk consistency validation
    const normalizedFormStatus = riskForm.clinical_status.replace(/\s+/g, '_').toUpperCase();
    if (riskForm.assessed_risk === 'LOW' && normalizedFormStatus === 'DETERIORATING') {
      setRiskError('Clinical status DETERIORATING is inconsistent with LOW risk assessment. Please select STABLE or IMPROVING.');
      return;
    }
    if (riskForm.assessed_risk === 'CRITICAL' && (normalizedFormStatus === 'DISCHARGE_READY' || riskForm.clinical_status === 'DISCHARGE READY')) {
      setRiskError('Clinical status DISCHARGE READY is inconsistent with CRITICAL risk assessment.');
      return;
    }
    setIsSubmittingRisk(true);
    setRiskError('');
    setRiskFeedback(null);

    try {
      const res = await fetch(`/api/patients/${selectedPatient.id}/risk-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          assessed_risk: riskForm.assessed_risk,
          clinical_status: riskForm.clinical_status,
          reason: riskForm.reason,
          clinical_notes: riskForm.clinical_notes,
          supporting_observations: riskForm.supporting_observations
        })
      });
      const data = await res.json();
      setIsSubmittingRisk(false);
      if (res.ok && data.success) {
        setRiskFeedback(data);
        setRiskForm({ ...riskForm, reason: '', clinical_notes: '', supporting_observations: '' });
        await fetchPatientDetail(selectedPatient.id);
        await fetchPatientHistory(selectedPatient.id);
        onRefresh();
      } else {
        setRiskError(data.error || 'Failed to record clinical risk assessment.');
      }
    } catch (err) {
      setIsSubmittingRisk(false);
      setRiskError(err.message);
    }
  };

  const handleRecordObservations = async (e) => {
    e.preventDefault();
    if (!selectedPatient) return;
    setIsSubmittingObs(true);
    setReassessmentFeedback(null);
    setReassessmentError('');

    const observations = [];
    if (obsForm.hr) observations.push({ type: 'HR', value: obsForm.hr, unit: 'bpm' });
    if (obsForm.bp_sys) observations.push({ type: 'BP_SYS', value: obsForm.bp_sys, unit: 'mmHg' });
    if (obsForm.bp_dia) observations.push({ type: 'BP_DIA', value: obsForm.bp_dia, unit: 'mmHg' });
    if (obsForm.spo2) observations.push({ type: 'SPO2', value: obsForm.spo2, unit: '%' });
    if (obsForm.resp_rate) observations.push({ type: 'RESP_RATE', value: obsForm.resp_rate, unit: 'breaths/min' });
    if (obsForm.temp) observations.push({ type: 'TEMP', value: obsForm.temp, unit: '°C' });
    if (obsForm.consciousness) observations.push({ type: 'CONSCIOUSNESS', value: obsForm.consciousness });
    if (obsForm.symptom) observations.push({ type: 'SYMPTOM', value: obsForm.symptom });

    if (observations.length === 0) { setIsSubmittingObs(false); return; }

    try {
      const res = await fetch(`/api/patients/${selectedPatient.id}/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ observations })
      });
      const data = await res.json();
      setIsSubmittingObs(false);
      if (res.ok && data.success) {
        setReassessmentFeedback(data.reassessment);
        setObsForm({ hr: '', bp_sys: '', bp_dia: '', spo2: '', resp_rate: '', temp: '', consciousness: 'ALERT', symptom: '' });
        await fetchPatientDetail(selectedPatient.id);
        await fetchPatientHistory(selectedPatient.id);
        onRefresh();
      } else {
        setReassessmentError(data.error || 'Failed to record observations.');
      }
    } catch (err) {
      setIsSubmittingObs(false);
      setReassessmentError(err.message);
    }
  };

  const handleCreateDischarge = async (e) => {
    e.preventDefault();
    if (!selectedPatient) return;

    if (hasUnsavedRiskDraft) {
      setDischargeError('Cannot submit discharge request while unsaved clinical risk assessment changes exist. Please save your assessment changes or discard draft first.');
      return;
    }

    setIsSubmittingDischarge(true);
    setDischargeError('');
    setDischargeFeedback(null);

    try {
      const result = await onCreateDischargeRequest(selectedPatient.id, {
        clinical_assessment: dischargeForm.clinical_assessment,
        final_condition: dischargeForm.final_condition,
        discharge_instructions: dischargeForm.discharge_instructions,
        follow_up_required: dischargeForm.follow_up_required,
        follow_up_notes: dischargeForm.follow_up_notes,
        has_unsaved_draft: hasUnsavedRiskDraft,
        draft_assessed_risk: riskForm.assessed_risk
      });
      setIsSubmittingDischarge(false);
      setDischargeFeedback(result);
      setDischargeForm({ clinical_assessment: '', final_condition: 'STABLE', discharge_instructions: '', follow_up_required: false, follow_up_notes: '' });
      onRefresh();
    } catch (err) {
      setIsSubmittingDischarge(false);
      setDischargeError(err.message);
    }
  };

  const handleResubmitDischarge = async (e) => {
    e.preventDefault();
    if (!activeDischargeRequest) return;
    setIsSubmittingDischarge(true);
    setDischargeError('');
    setDischargeFeedback(null);

    try {
      const result = await onResubmitDischarge(activeDischargeRequest.id, {
        clinical_assessment: dischargeForm.clinical_assessment,
        final_condition: dischargeForm.final_condition,
        discharge_instructions: dischargeForm.discharge_instructions,
        follow_up_required: dischargeForm.follow_up_required,
        follow_up_notes: dischargeForm.follow_up_notes
      });
      setIsSubmittingDischarge(false);
      setDischargeFeedback(result);
      onRefresh();
    } catch (err) {
      setIsSubmittingDischarge(false);
      setDischargeError(err.message);
    }
  };

  const handleCancelRequest = async (requestId) => {
    try {
      await onCancelDischargeRequest(requestId);
      setDischargeForm({ clinical_assessment: '', final_condition: 'STABLE', discharge_instructions: '', follow_up_required: false, follow_up_notes: '' });
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const riskColor = (level) => {
    const colors = { CRITICAL: '#ef4444', HIGH: '#f59e0b', MODERATE: '#3b82f6', LOW: '#10b981' };
    return colors[level] || '#6b7280';
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
            CLINICAL WORKSPACE
          </div>
          <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
            {user.name}
          </div>
          <div className="mono" style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', marginTop: '2px' }}>
            ID: {user.doctor_id || doctorProfile?.id || user.id}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {user.specialty || doctorProfile?.specialty || 'General Practice'}
          </div>

          {workloadInfo && (
            <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Active Load:</span>
                <span style={{ fontWeight: 600, color: workloadInfo.workload_percentage >= 100 ? '#ef4444' : 'var(--accent-emerald)' }}>
                  {workloadInfo.current_load} / {workloadInfo.max_capacity} ({workloadInfo.workload_percentage}%)
                </span>
              </div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, workloadInfo.workload_percentage)}%`,
                  backgroundColor: workloadInfo.workload_percentage >= 100 ? '#ef4444' : workloadInfo.workload_percentage >= 80 ? '#f59e0b' : '#10b981'
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Pending Discharge Requests Badge */}
        {pendingRequests.length > 0 && (
          <div style={{ padding: '10px 12px', margin: '8px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 600 }}>
              ⏳ {pendingRequests.length} Discharge Request{pendingRequests.length > 1 ? 's' : ''} Pending
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Awaiting receptionist review
            </div>
          </div>
        )}

        <div style={{ padding: '12px', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Active Patients ({assignedPatients.length})
          </div>
          {assignedPatients.map(p => {
            const isSelected = selectedPatient?.id === p.id;
            const req = dischargeRequests.find(dr => dr.patient_id === p.id && (dr.status === 'PENDING' || dr.status === 'RETURNED_FOR_CLARIFICATION'));
            return (
              <div
                key={p.id}
                onClick={() => setSelectedPatient(p)}
                style={{
                  padding: '10px 12px', marginBottom: '6px', borderRadius: '6px',
                  border: isSelected ? '1px solid var(--accent-emerald)' : '1px solid var(--border-color)',
                  backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.1)' : req?.status === 'RETURNED_FOR_CLARIFICATION' ? 'rgba(236, 72, 153, 0.08)' : req?.status === 'PENDING' ? 'rgba(251, 191, 36, 0.05)' : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{p.name}</span>
                  <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', background: `${riskColor(p.clinical_risk_level)}22`, color: riskColor(p.clinical_risk_level), fontWeight: 700 }}>
                    {p.clinical_risk_level || 'LOW'}
                  </span>
                </div>
                <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                  {p.id} | {p.emergency_category}
                  {req?.status === 'PENDING' && <span style={{ color: '#fbbf24', marginLeft: '6px' }}>⏳ PENDING</span>}
                  {req?.status === 'RETURNED_FOR_CLARIFICATION' && <span style={{ color: '#ec4899', marginLeft: '6px' }}>💬 RETURNED</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
          <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={onLogout}>
            🔒 Logout
          </button>
        </div>
      </aside>

      {/* Main Clinical Content */}
      <div className="main-content">
        <header className="header">
          <div>
            <h2 style={{ fontSize: '1.05rem', letterSpacing: '0.5px' }}>CAREBRIDGE 2.0 | CLINICAL WORKSPACE</h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Doctor: <strong style={{ color: 'var(--accent-emerald)' }}>{user.name}</strong> ({user.specialty || 'General'})
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onLogout}>Logout</button>
        </header>

        <main className="view-container">
          {selectedPatient ? (
            <div>
              {accessDeniedError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #f87171', color: '#f87171', padding: '16px 20px', borderRadius: '8px', marginBottom: '20px', fontWeight: 600 }}>
                  ⚠️ {accessDeniedError}
                </div>
              )}

              {/* Patient Header */}
              <div className="card" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ fontSize: '1.4rem' }}>{selectedPatient.name}</h2>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      ID: <span className="mono" style={{ color: 'var(--accent-cyan)' }}>{selectedPatient.id}</span> | Age: {selectedPatient.age} | Gender: {selectedPatient.gender} | Category: <strong style={{ color: 'var(--accent-cyan)' }}>{selectedPatient.emergency_category}</strong>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Status: <strong style={{ color: selectedPatient.status === 'DISCHARGE_REQUESTED' ? '#fbbf24' : 'var(--accent-emerald)' }}>
                        {selectedPatient.status}
                      </strong>
                      {selectedPatient.room_number && <> | Room: <strong>{selectedPatient.room_number}</strong></>}
                      {selectedPatient.doctor_name && <> | Doctor: <strong>{selectedPatient.doctor_name}</strong></>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700, background: `${riskColor(selectedPatient.clinical_risk_level)}22`, color: riskColor(selectedPatient.clinical_risk_level) }}>
                      RISK: {selectedPatient.clinical_risk_level || 'LOW'}
                    </span>
                    <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700, background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>
                      {selectedPatient.operational_priority_level || 'NOT_ASSESSED'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Panel Toggle */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <button
                  className={`btn ${activePanel === 'observations' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setActivePanel('observations')}
                >
                  🩺 Clinical Risk Assessment & Observations
                </button>
                <button
                  className={`btn ${activePanel === 'discharge' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, justifyContent: 'center', backgroundColor: activePanel === 'discharge' ? '#f59e0b' : undefined }}
                  onClick={() => setActivePanel('discharge')}
                >
                  📋 Discharge Request {activeDischargeRequest ? `(${activeDischargeRequest.status === 'RETURNED_FOR_CLARIFICATION' ? 'Returned' : 'Pending'})` : ''}
                </button>
              </div>

              {/* Reassessment Feedback Alert */}
              {reassessmentFeedback && activePanel === 'observations' && (
                <div style={{ background: 'rgba(6, 182, 212, 0.12)', border: '1px solid var(--accent-cyan)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                  <h4 style={{ color: 'var(--accent-cyan)', fontSize: '0.95rem', marginBottom: '6px' }}>⚡ Automatic Reassessment Completed</h4>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
                    {reassessmentFeedback.explanation}
                  </div>
                </div>
              )}

              {/* PANEL: Clinical Risk & Observations */}
              {activePanel === 'observations' && (
                <div>
                  {/* CARD: Dedicated Clinical Risk Assessment Control */}
                  <div className="card" style={{ marginBottom: '20px', border: '1px solid var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                      <div>
                        <h3 style={{ color: 'var(--accent-emerald)', fontSize: '1.1rem', margin: 0 }}>👨‍⚕️ Clinical Risk Assessment Control</h3>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                          Explicit physician risk evaluation. System risk and doctor clinical assessments are both preserved.
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>System Risk</div>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, padding: '3px 10px', borderRadius: '4px', background: `${riskColor(selectedPatient.system_calculated_risk || selectedPatient.clinical_risk_level)}22`, color: riskColor(selectedPatient.system_calculated_risk || selectedPatient.clinical_risk_level) }}>
                            {selectedPatient.system_calculated_risk || selectedPatient.clinical_risk_level || 'LOW'}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Doctor Risk</div>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, padding: '3px 10px', borderRadius: '4px', background: `${riskColor(selectedPatient.doctor_assessed_risk || selectedPatient.clinical_risk_level)}22`, color: riskColor(selectedPatient.doctor_assessed_risk || selectedPatient.clinical_risk_level) }}>
                            {selectedPatient.doctor_assessed_risk || selectedPatient.clinical_risk_level || 'NOT SET'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Risk Disagreement Warning Banner */}
                    {selectedPatient.risk_reconciliation_status === 'DOCTOR_DEESCALATED' && (
                      <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #34d399', padding: '12px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem', color: '#34d399', lineHeight: '1.5' }}>
                        <strong>✓ Clinical De-escalation Applied:</strong> Doctor assessment (<strong>{selectedPatient.doctor_assessed_risk}</strong>) de-escalated from system risk (<strong>{selectedPatient.system_calculated_risk || selectedPatient.clinical_risk_level}</strong>). Priority updated to <strong>{selectedPatient.operational_priority_level}</strong>.
                      </div>
                    )}
                    {(selectedPatient.risk_reconciliation_status === 'REVIEW_REQUIRED' || (selectedPatient.risk_reconciliation_status !== 'DOCTOR_DEESCALATED' && selectedPatient.system_calculated_risk && selectedPatient.doctor_assessed_risk && selectedPatient.system_calculated_risk !== selectedPatient.doctor_assessed_risk)) && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #f87171', padding: '12px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem', color: '#f87171', lineHeight: '1.5' }}>
                        <strong>⚠️ Assessment Differs from System Risk:</strong> System automated estimate is <strong>{selectedPatient.system_calculated_risk || selectedPatient.clinical_risk_level}</strong> while Doctor assessment is <strong>{selectedPatient.doctor_assessed_risk || 'NOT SET'}</strong>.{selectedPatient.risk_reconciliation_status === 'REVIEW_REQUIRED' ? ' Hard safety review protocols active.' : ''}
                      </div>
                    )}

                    {riskError && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #f87171', color: '#f87171', padding: '10px 12px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.85rem' }}>
                        ⚠️ {riskError}
                      </div>
                    )}

                    {riskFeedback && (
                      <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #34d399', color: '#34d399', padding: '12px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.85rem' }}>
                        <div><strong>✓ Clinical Assessment Recorded Successfully</strong></div>
                        <div style={{ marginTop: '4px' }}>
                          Effective Risk: <strong>{riskFeedback.effective_risk}</strong> | Priority Level: <strong>{riskFeedback.effective_priority}</strong>
                        </div>
                        {riskFeedback.discharge_request_created && (
                          <div style={{ marginTop: '6px', color: '#fbbf24', fontSize: '0.82rem' }}>
                            ⏳ Status set to DISCHARGE READY. Pending discharge request created for Receptionist review. Patient remains ACTIVE.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Unsaved Changes Banner */}
                    {(riskForm.assessed_risk !== (selectedPatient.doctor_assessed_risk || selectedPatient.clinical_risk_level || 'LOW')) && (
                      <div style={{ background: 'rgba(251, 191, 36, 0.12)', border: '1px solid #fbbf24', padding: '10px 14px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.82rem', color: '#fbbf24', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>⚠️ STATUS: UNSAVED CHANGES</strong>
                          <div style={{ fontSize: '0.78rem', marginTop: '2px', color: 'var(--text-muted)' }}>
                            Current Saved Risk: <strong>{selectedPatient.doctor_assessed_risk || selectedPatient.clinical_risk_level || 'LOW'}</strong> → New Unsaved Assessment: <strong style={{ color: '#fbbf24' }}>{riskForm.assessed_risk}</strong>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.72rem', background: '#fbbf24', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>UNSAVED DRAFT</span>
                      </div>
                    )}

                    <form onSubmit={handleSaveRiskAssessment}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                        <div className="form-group">
                          <label style={{ fontWeight: 600 }}>Doctor Clinical Risk Level *</label>
                          <select
                            className="form-control"
                            value={riskForm.assessed_risk}
                            onChange={(e) => {
                              const newRisk = e.target.value;
                              let adjustedStatus = riskForm.clinical_status;
                              // Auto-adjust status to avoid contradictions
                              if (newRisk === 'LOW' && adjustedStatus === 'DETERIORATING') adjustedStatus = 'IMPROVING';
                              if (newRisk === 'CRITICAL' && (adjustedStatus === 'DISCHARGE READY' || adjustedStatus === 'DISCHARGE_READY')) adjustedStatus = 'DETERIORATING';
                              setRiskForm({ ...riskForm, assessed_risk: newRisk, clinical_status: adjustedStatus });
                            }}
                          >
                            <option value="CRITICAL">🔴 CRITICAL — Life-threatening / Intensive Care</option>
                            <option value="HIGH">🟠 HIGH — Acute / High monitoring</option>
                            <option value="MODERATE">🔵 MODERATE — Semi-urgent / Stable monitoring</option>
                            <option value="LOW">🟢 LOW — Low acuity / Standard ward</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label style={{ fontWeight: 600 }}>Clinical Status *</label>
                          <select
                            className="form-control"
                            value={riskForm.clinical_status}
                            onChange={(e) => {
                              const newStatus = e.target.value;
                              let adjustedRisk = riskForm.assessed_risk;
                              // Auto-adjust risk to avoid contradictions
                              if (newStatus === 'DETERIORATING' && adjustedRisk === 'LOW') adjustedRisk = 'MODERATE';
                              if ((newStatus === 'DISCHARGE READY' || newStatus === 'DISCHARGE_READY') && adjustedRisk === 'CRITICAL') adjustedRisk = 'LOW';
                              setRiskForm({ ...riskForm, clinical_status: newStatus, assessed_risk: adjustedRisk });
                            }}
                          >
                            <option value="STABLE">STABLE — Baseline condition maintained</option>
                            <option value="IMPROVING">IMPROVING — Favorable treatment response</option>
                            <option value="DETERIORATING">DETERIORATING — Declining clinical trajectory</option>
                            <option value="DISCHARGE READY">DISCHARGE READY — Ready for administrative discharge</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: '14px' }}>
                        <label style={{ fontWeight: 600 }}>Reason for Clinical Assessment (Mandatory) *</label>
                        <textarea
                          className="form-control"
                          rows="2"
                          placeholder="Provide clinical justification (e.g. Patient condition improving following oxygen therapy and IV medication...)"
                          value={riskForm.reason}
                          onChange={(e) => setRiskForm({ ...riskForm, reason: e.target.value })}
                          style={{ resize: 'vertical' }}
                          required
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={{ fontWeight: 600 }}>Supporting Clinical Notes / Diagnostics (Optional)</label>
                        <textarea
                          className="form-control"
                          rows="2"
                          placeholder="Relevant lab results, imaging notes, physical exam findings..."
                          value={riskForm.clinical_notes}
                          onChange={(e) => setRiskForm({ ...riskForm, clinical_notes: e.target.value })}
                          style={{ resize: 'vertical' }}
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center', backgroundColor: 'var(--accent-emerald)', padding: '12px', fontSize: '0.92rem', fontWeight: 600 }}
                        disabled={isSubmittingRisk || !riskForm.reason.trim()}
                      >
                        {isSubmittingRisk ? 'Saving Clinical Risk Assessment...' : '💾 Save Clinical Risk Assessment'}
                      </button>
                    </form>
                  </div>

                  {/* 2 Grid Cards: Record Vitals & Clinical History Timeline */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div className="card">
                      <h3 style={{ marginBottom: '12px', color: 'var(--accent-cyan)' }}>🩺 Record Clinical Observations</h3>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                        Record physiological measurements. Reassesses automated system risk without overwriting explicit physician assessments.
                      </div>

                      {reassessmentError && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #f87171', color: '#f87171', padding: '10px 12px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.85rem' }}>
                          ⚠️ {reassessmentError}
                        </div>
                      )}

                      <form onSubmit={handleRecordObservations}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div className="form-group">
                            <label>Heart Rate (bpm)</label>
                            <input type="number" className="form-control" placeholder="e.g. 125" value={obsForm.hr} onChange={(e) => setObsForm({ ...obsForm, hr: e.target.value })} />
                          </div>
                          <div className="form-group">
                            <label>Systolic BP (mmHg)</label>
                            <input type="number" className="form-control" placeholder="e.g. 90" value={obsForm.bp_sys} onChange={(e) => setObsForm({ ...obsForm, bp_sys: e.target.value })} />
                          </div>
                          <div className="form-group">
                            <label>SpO2 Saturation (%)</label>
                            <input type="number" className="form-control" placeholder="e.g. 88" value={obsForm.spo2} onChange={(e) => setObsForm({ ...obsForm, spo2: e.target.value })} />
                          </div>
                          <div className="form-group">
                            <label>Respiratory Rate</label>
                            <input type="number" className="form-control" placeholder="e.g. 28" value={obsForm.resp_rate} onChange={(e) => setObsForm({ ...obsForm, resp_rate: e.target.value })} />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>New Symptom / Observation Note</label>
                          <input type="text" className="form-control" placeholder="e.g. ST-elevation worsening" value={obsForm.symptom} onChange={(e) => setObsForm({ ...obsForm, symptom: e.target.value })} />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', backgroundColor: 'var(--accent-cyan)' }} disabled={isSubmittingObs}>
                          {isSubmittingObs ? 'Recording Vitals...' : 'Save Vitals & Reassess System Risk'}
                        </button>
                      </form>
                    </div>

                    <div className="card">
                      <h3 style={{ marginBottom: '12px', color: 'var(--accent-purple)' }}>📜 Clinical Risk & Priority Timeline</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
                        {/* Doctor Clinical Assessments */}
                        {patientHistory.clinical_assessments?.map((ca) => (
                          <div key={ca.id} style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: '0.82rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '4px' }}>
                              <span>👨‍⚕️ <strong style={{ color: 'var(--accent-emerald)' }}>{ca.doctor_name || 'Doctor'}</strong>: <strong style={{ color: riskColor(ca.assessed_risk) }}>{ca.previous_risk} → {ca.assessed_risk}</strong></span>
                              <span style={{ fontSize: '0.73rem' }}>{new Date(ca.created_at).toLocaleTimeString()}</span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', fontStyle: 'italic' }}>
                              "{ca.reason}"
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              Status: <strong>{ca.clinical_status}</strong> | Priority: <strong style={{ color: { P1: '#ef4444', P2: '#f59e0b', P3: '#3b82f6', P4: '#10b981' }[ca.resulting_priority] || 'var(--text-muted)' }}>{ca.resulting_priority}</strong>
                            </div>
                          </div>
                        ))}

                        {/* System Risk History */}
                        {patientHistory.risk_history?.map((r) => (
                          <div key={r.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '2px' }}>
                              <span>Risk Transition: <strong style={{ color: '#f87171' }}>{r.previous_risk} → {r.new_risk}</strong></span>
                              <span style={{ fontSize: '0.75rem' }}>{new Date(r.calculated_at).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        ))}

                        {/* Vitals Observations */}
                        {patientHistory.observations?.map((o) => (
                          <div key={o.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '4px', fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{o.observation_type}:</span> <strong className="mono">{o.value} {o.unit || ''}</strong>
                            <span style={{ float: 'right', fontSize: '0.72rem', color: 'var(--text-dim)' }}>{new Date(o.recorded_at).toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PANEL: Discharge Request */}
              {activePanel === 'discharge' && (
                <div className="card" style={{ maxWidth: '800px' }}>
                  {/* If request is returned for clarification */}
                  {activeDischargeRequest?.status === 'RETURNED_FOR_CLARIFICATION' ? (
                    <div>
                      <h3 style={{ color: '#ec4899', marginBottom: '12px' }}>💬 Discharge Request Returned for Clarification</h3>
                      <div style={{ background: 'rgba(236, 72, 153, 0.08)', border: '1px solid rgba(236, 72, 153, 0.3)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                        <div style={{ fontSize: '0.88rem', lineHeight: '1.7' }}>
                          <div><strong>Request ID:</strong> <span className="mono" style={{ color: 'var(--accent-cyan)' }}>{activeDischargeRequest.id}</span></div>
                          <div style={{ color: '#ec4899', marginTop: '6px', fontWeight: 600 }}>
                            <strong>Reason Returned by Receptionist:</strong> {activeDischargeRequest.clarification_reason}
                          </div>
                        </div>
                      </div>

                      {dischargeError && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #f87171', color: '#f87171', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
                          ⚠️ {dischargeError}
                        </div>
                      )}

                      {dischargeFeedback && (
                        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #34d399', color: '#34d399', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
                          ✓ {dischargeFeedback.message}
                        </div>
                      )}

                      <form onSubmit={handleResubmitDischarge}>
                        <h4 style={{ fontSize: '0.95rem', color: 'var(--accent-cyan)', marginBottom: '10px' }}>Revise Clinical Assessment & Resubmit</h4>
                        <div className="form-group">
                          <label style={{ fontWeight: 600 }}>Revised Clinical Assessment *</label>
                          <textarea
                            className="form-control"
                            rows="4"
                            value={dischargeForm.clinical_assessment}
                            onChange={(e) => setDischargeForm({ ...dischargeForm, clinical_assessment: e.target.value })}
                            style={{ resize: 'vertical' }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div className="form-group">
                            <label style={{ fontWeight: 600 }}>Final Clinical Condition</label>
                            <select className="form-control" value={dischargeForm.final_condition} onChange={(e) => setDischargeForm({ ...dischargeForm, final_condition: e.target.value })}>
                              <option value="STABLE">STABLE — Clinically stable</option>
                              <option value="IMPROVED">IMPROVED — Condition improved from admission</option>
                              <option value="FAIR">FAIR — Acceptable for outpatient follow-up</option>
                              <option value="GUARDED">GUARDED — Monitor closely post-discharge</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label style={{ fontWeight: 600 }}>Follow-Up Required?</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.88rem' }}>
                                <input
                                  type="checkbox"
                                  checked={dischargeForm.follow_up_required}
                                  onChange={(e) => setDischargeForm({ ...dischargeForm, follow_up_required: e.target.checked })}
                                />
                                Yes, schedule follow-up
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="form-group">
                          <label style={{ fontWeight: 600 }}>Discharge Instructions for Patient</label>
                          <textarea
                            className="form-control"
                            rows="2"
                            value={dischargeForm.discharge_instructions}
                            onChange={(e) => setDischargeForm({ ...dischargeForm, discharge_instructions: e.target.value })}
                            style={{ resize: 'vertical' }}
                          />
                        </div>

                        {dischargeForm.follow_up_required && (
                          <div className="form-group">
                            <label style={{ fontWeight: 600 }}>Follow-Up Notes</label>
                            <input
                              type="text"
                              className="form-control"
                              value={dischargeForm.follow_up_notes}
                              onChange={(e) => setDischargeForm({ ...dischargeForm, follow_up_notes: e.target.value })}
                            />
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                          <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ flex: 1, justifyContent: 'center', backgroundColor: '#ec4899', fontSize: '0.95rem', padding: '12px' }}
                            disabled={isSubmittingDischarge || dischargeForm.clinical_assessment.trim().length < 10}
                          >
                            {isSubmittingDischarge ? 'Resubmitting...' : '🔄 Resubmit Discharge Request to Reception'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid #f87171' }}
                            onClick={() => handleCancelRequest(activeDischargeRequest.id)}
                          >
                            ❌ Cancel Request
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : activeDischargeRequest?.status === 'PENDING' ? (
                    <div>
                      <h3 style={{ color: '#fbbf24', marginBottom: '12px' }}>⏳ Discharge Request Already Submitted</h3>
                      <div style={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.25)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                        <div style={{ fontSize: '0.85rem', lineHeight: '1.7' }}>
                          <div><strong>Request ID:</strong> <span className="mono" style={{ color: 'var(--accent-cyan)' }}>{activeDischargeRequest.id}</span></div>
                          <div><strong>Clinical Assessment:</strong> {activeDischargeRequest.clinical_assessment}</div>
                          <div><strong>Final Condition:</strong> <span style={{ color: '#10b981', fontWeight: 600 }}>{activeDischargeRequest.final_condition}</span></div>
                          <div><strong>Created:</strong> {new Date(activeDischargeRequest.created_at).toLocaleString()}</div>
                          <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '4px', fontSize: '0.82rem', color: '#fbbf24' }}>
                            ⏳ Waiting for Receptionist to review and complete administrative discharge.
                          </div>
                        </div>
                      </div>
                      <button className="btn btn-secondary" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid #f87171' }} onClick={() => handleCancelRequest(activeDischargeRequest.id)}>
                        ❌ Cancel Discharge Request
                      </button>
                    </div>
                  ) : selectedPatient.status === 'DISCHARGED' ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      <h3 style={{ color: '#10b981' }}>✅ Patient Already Discharged</h3>
                      <p>This patient has been fully discharged from the system.</p>
                    </div>
                  ) : (
                    <div>
                      <h3 style={{ color: 'var(--accent-emerald)', marginBottom: '6px' }}>📋 Create Discharge Request</h3>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.6' }}>
                        <strong>Clinical Authority Workflow:</strong> As the attending physician, you determine when a patient is clinically ready for discharge.
                        Submitting this request sends it to the Reception desk for administrative processing.
                        The Receptionist will review your clinical assessment and complete the discharge, releasing the room, bed, and allocated resources.
                      </div>

                      {/* Workflow Diagram */}
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '20px', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.8' }}>
                        <strong style={{ color: 'var(--accent-cyan)' }}>Workflow:</strong><br/>
                        <span style={{ color: 'var(--accent-emerald)' }}>Doctor</span> → Clinical Assessment → Create Discharge Request →
                        <span style={{ color: 'var(--accent-cyan)' }}> Receptionist</span> → Reviews Request → Completes Administrative Discharge →
                        <span style={{ color: '#10b981' }}> Patient Discharged</span> → Room & Resources Released
                      </div>

                      {hasUnsavedRiskDraft && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #f87171', padding: '14px 16px', borderRadius: '8px', marginBottom: '16px' }}>
                          <h4 style={{ color: '#f87171', margin: 0, fontSize: '0.95rem' }}>⚠️ CANNOT PROCEED TO DISCHARGE: Unsaved Assessment Draft</h4>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', marginTop: '4px', marginBottom: '10px' }}>
                            Saved Risk: <strong>{savedRisk}</strong> | Unsaved Draft: <strong style={{ color: '#fbbf24' }}>{riskForm.assessed_risk}</strong>
                            <br/>
                            You must save or discard your clinical assessment changes before submitting a discharge request.
                          </div>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="button" className="btn btn-primary" style={{ backgroundColor: 'var(--accent-emerald)', fontSize: '0.8rem', padding: '6px 12px' }} onClick={handleSaveRiskAssessment}>
                              💾 Save Assessment
                            </button>
                            <button type="button" className="btn btn-secondary" style={{ backgroundColor: 'rgba(255,255,255,0.1)', fontSize: '0.8rem', padding: '6px 12px' }} onClick={handleDiscardRiskDraft}>
                              🔄 Discard Draft
                            </button>
                          </div>
                        </div>
                      )}

                      {dischargeError && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #f87171', color: '#f87171', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
                          ⚠️ {dischargeError}
                        </div>
                      )}

                      {dischargeFeedback && (
                        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #34d399', color: '#34d399', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
                          ✓ {dischargeFeedback.message}
                        </div>
                      )}

                      <form onSubmit={handleCreateDischarge}>
                        <div className="form-group">
                          <label style={{ fontWeight: 600 }}>Clinical Assessment / Discharge Summary *</label>
                          <textarea
                            className="form-control"
                            rows="4"
                            placeholder="Provide clinical justification for discharge. Include response to treatment, current condition, and readiness assessment (min 10 characters)..."
                            value={dischargeForm.clinical_assessment}
                            onChange={(e) => setDischargeForm({ ...dischargeForm, clinical_assessment: e.target.value })}
                            style={{ resize: 'vertical' }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div className="form-group">
                            <label style={{ fontWeight: 600 }}>Final Clinical Condition</label>
                            <select className="form-control" value={dischargeForm.final_condition} onChange={(e) => setDischargeForm({ ...dischargeForm, final_condition: e.target.value })}>
                              <option value="STABLE">STABLE — Clinically stable</option>
                              <option value="IMPROVED">IMPROVED — Condition improved from admission</option>
                              <option value="FAIR">FAIR — Acceptable for outpatient follow-up</option>
                              <option value="GUARDED">GUARDED — Monitor closely post-discharge</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label style={{ fontWeight: 600 }}>Follow-Up Required?</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.88rem' }}>
                                <input
                                  type="checkbox"
                                  checked={dischargeForm.follow_up_required}
                                  onChange={(e) => setDischargeForm({ ...dischargeForm, follow_up_required: e.target.checked })}
                                />
                                Yes, schedule follow-up
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="form-group">
                          <label style={{ fontWeight: 600 }}>Discharge Instructions for Patient</label>
                          <textarea
                            className="form-control"
                            rows="2"
                            placeholder="Medications, activity restrictions, dietary guidance, warning signs to watch for..."
                            value={dischargeForm.discharge_instructions}
                            onChange={(e) => setDischargeForm({ ...dischargeForm, discharge_instructions: e.target.value })}
                            style={{ resize: 'vertical' }}
                          />
                        </div>

                        {dischargeForm.follow_up_required && (
                          <div className="form-group">
                            <label style={{ fontWeight: 600 }}>Follow-Up Notes</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="e.g. Cardiology follow-up in 1 week, repeat ECG..."
                              value={dischargeForm.follow_up_notes}
                              onChange={(e) => setDischargeForm({ ...dischargeForm, follow_up_notes: e.target.value })}
                            />
                          </div>
                        )}

                        <button
                          type="submit"
                          className="btn btn-primary"
                          style={{ width: '100%', justifyContent: 'center', marginTop: '16px', backgroundColor: hasUnsavedRiskDraft ? '#6b7280' : '#f59e0b', fontSize: '0.95rem', padding: '12px' }}
                          disabled={isSubmittingDischarge || hasUnsavedRiskDraft || dischargeForm.clinical_assessment.trim().length < 10}
                        >
                          {isSubmittingDischarge ? 'Creating Discharge Request...' : hasUnsavedRiskDraft ? '🔒 Blocked: Save Assessment Draft First' : '📋 Submit Discharge Request to Reception'}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Select a patient from the left panel to begin clinical review.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

