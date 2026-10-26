import React, { useState, useEffect } from 'react';
import PatientsView from '../views/PatientsView';
import PatientDetailModal from '../components/PatientDetailModal';

export default function ReceptionWorkspace({
  user,
  token,
  patients,
  dischargeRequests = [],
  onAdmitPatient,
  onApproveDischarge,
  onReturnDischarge,
  onRejectDischarge,
  onRefresh,
  onLogout
}) {
  const [activeTab, setActiveTab] = useState('register');
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Discharged archive state
  const [dischargedPatientsList, setDischargedPatientsList] = useState([]);
  const [dischargedLoading, setDischargedLoading] = useState(false);
  const [dischargedError, setDischargedError] = useState(null);

  const fetchDischargedPatients = async () => {
    if (!token) return;
    setDischargedLoading(true);
    setDischargedError(null);
    try {
      const res = await fetch('/api/patients/discharged', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setDischargedPatientsList(data);
    } catch (err) {
      console.error('Error fetching discharged archive:', err);
      setDischargedError(err.message);
    } finally {
      setDischargedLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'discharged') {
      fetchDischargedPatients();
    }
  }, [activeTab, token]);

  // Discharge review state
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [clarificationReason, setClarificationReason] = useState('');

  // 3-Item Mandatory Administrative Checklist
  const [checklist, setChecklist] = useState({
    identity_verified: false,
    doctor_request_reviewed: false,
    administrative_summary_completed: false
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingFeedback, setProcessingFeedback] = useState(null);
  const [processingError, setProcessingError] = useState('');
  const [dischargeFilter, setDischargeFilter] = useState('PENDING');

  const activePatients = patients.filter(p => p.status !== 'DISCHARGED');
  const dischargedPatients = dischargedPatientsList;
  const pendingRequests = dischargeRequests.filter(dr => dr.status === 'PENDING');
  const returnedRequests = dischargeRequests.filter(dr => dr.status === 'RETURNED_FOR_CLARIFICATION');

  const filteredRequests = dischargeFilter === 'ALL'
    ? dischargeRequests
    : dischargeRequests.filter(dr => dr.status === dischargeFilter);

  const resetChecklist = () => {
    setChecklist({
      identity_verified: false,
      doctor_request_reviewed: false,
      administrative_summary_completed: false
    });
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    if (!checklist.identity_verified || !checklist.doctor_request_reviewed || !checklist.administrative_summary_completed) {
      setProcessingError('All mandatory administrative checklist items must be verified before completing discharge.');
      return;
    }

    setIsProcessing(true);
    setProcessingError('');
    setProcessingFeedback(null);
    try {
      const result = await onApproveDischarge(selectedRequest.id, adminNotes, checklist);
      setProcessingFeedback(result);
      setSelectedRequest(null);
      setAdminNotes('');
      resetChecklist();
      fetchDischargedPatients();
      setIsProcessing(false);
    } catch (err) {
      setProcessingError(err.message);
      setIsProcessing(false);
    }
  };

  const handleReturnToDoctor = async () => {
    if (!selectedRequest) return;
    if (!clarificationReason.trim()) {
      setProcessingError('Mandatory clarification reason is required to return a request to the attending doctor.');
      return;
    }

    setIsProcessing(true);
    setProcessingError('');
    setProcessingFeedback(null);
    try {
      const result = await onReturnDischarge(selectedRequest.id, clarificationReason);
      setProcessingFeedback(result);
      setSelectedRequest(null);
      setClarificationReason('');
      resetChecklist();
      setIsProcessing(false);
    } catch (err) {
      setProcessingError(err.message);
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    if (!rejectionReason.trim()) {
      setProcessingError('Please provide a reason for rejecting the discharge request.');
      return;
    }
    setIsProcessing(true);
    setProcessingError('');
    setProcessingFeedback(null);
    try {
      const result = await onRejectDischarge(selectedRequest.id, rejectionReason);
      setProcessingFeedback(result);
      setSelectedRequest(null);
      setRejectionReason('');
      resetChecklist();
      setIsProcessing(false);
    } catch (err) {
      setProcessingError(err.message);
      setIsProcessing(false);
    }
  };

  const conditionColor = (condition) => {
    const colors = { STABLE: '#10b981', IMPROVED: '#3b82f6', FAIR: '#f59e0b', GUARDED: '#ef4444' };
    return colors[condition] || '#6b7280';
  };

  const statusColor = (status) => {
    const colors = {
      PENDING: '#fbbf24',
      APPROVED: '#10b981',
      REJECTED: '#ef4444',
      CANCELLED: '#6b7280',
      RETURNED_FOR_CLARIFICATION: '#ec4899'
    };
    return colors[status] || '#6b7280';
  };

  const allChecklistItemsChecked = checklist.identity_verified && checklist.doctor_request_reviewed && checklist.administrative_summary_completed;

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
            RECEPTION & INTAKE
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
            Administrative Control Desk
          </div>
        </div>

        <nav style={{ padding: '12px', flex: 1 }}>
          <button
            onClick={() => { setActiveTab('register'); setSelectedRequest(null); }}
            style={{
              width: '100%', textAlign: 'left', padding: '10px 14px', marginBottom: '4px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: activeTab === 'register' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
              color: activeTab === 'register' ? 'var(--accent-cyan)' : 'var(--text-muted)', fontSize: '0.88rem'
            }}
          >
            📋 Register New Patient
          </button>

          <button
            onClick={() => { setActiveTab('discharge-queue'); setSelectedRequest(null); setProcessingFeedback(null); setProcessingError(''); }}
            style={{
              width: '100%', textAlign: 'left', padding: '10px 14px', marginBottom: '4px', borderRadius: '6px', border: 'none', cursor: 'pointer', position: 'relative',
              background: activeTab === 'discharge-queue' ? 'rgba(251, 191, 36, 0.15)' : 'transparent',
              color: activeTab === 'discharge-queue' ? '#fbbf24' : 'var(--text-muted)', fontSize: '0.88rem'
            }}
          >
            📤 Discharge Requests
            {pendingRequests.length > 0 && (
              <span style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                background: '#ef4444', color: '#fff', borderRadius: '12px', padding: '2px 8px',
                fontSize: '0.72rem', fontWeight: 700, minWidth: '20px', textAlign: 'center',
                animation: 'pulse 2s infinite'
              }}>
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab('active'); setSelectedRequest(null); }}
            style={{
              width: '100%', textAlign: 'left', padding: '10px 14px', marginBottom: '4px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: activeTab === 'active' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
              color: activeTab === 'active' ? 'var(--accent-cyan)' : 'var(--text-muted)', fontSize: '0.88rem'
            }}
          >
            🏥 Active Admissions ({activePatients.length})
          </button>

          <button
            onClick={() => { setActiveTab('discharged'); setSelectedRequest(null); }}
            style={{
              width: '100%', textAlign: 'left', padding: '10px 14px', marginBottom: '4px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: activeTab === 'discharged' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
              color: activeTab === 'discharged' ? 'var(--accent-cyan)' : 'var(--text-muted)', fontSize: '0.88rem'
            }}
          >
            📜 Discharged Archive ({dischargedPatients.length})
          </button>
        </nav>

        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
          <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={onLogout}>
            🔒 Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        <header className="header">
          <div>
            <h2 style={{ fontSize: '1.05rem', letterSpacing: '0.5px' }}>CAREBRIDGE 2.0 | PATIENT INTAKE & RECEPTION</h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Logged in as: <strong style={{ color: 'var(--accent-cyan)' }}>{user.name}</strong> (Receptionist)
              {pendingRequests.length > 0 && (
                <span style={{ marginLeft: '12px', color: '#fbbf24', fontWeight: 600 }}>
                  ⚠️ {pendingRequests.length} discharge request{pendingRequests.length > 1 ? 's' : ''} awaiting administrative review
                </span>
              )}
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onLogout}>Logout</button>
        </header>

        <main className="view-container">
          {/* Live Counters Overview Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <div className="card" style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Admissions</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-cyan)', marginTop: '2px' }}>{activePatients.length}</div>
            </div>
            <div className="card" style={{ padding: '14px 18px', border: pendingRequests.length > 0 ? '1px solid #fbbf24' : undefined }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Discharge Requests</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fbbf24', marginTop: '2px' }}>{pendingRequests.length}</div>
            </div>
            <div className="card" style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Returned for Clarification</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ec4899', marginTop: '2px' }}>{returnedRequests.length}</div>
            </div>
            <div className="card" style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Discharged Archive</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-emerald)', marginTop: '2px' }}>{dischargedPatients.length}</div>
            </div>
          </div>

          {/* Register Patient / Active Patients Tab */}
          {(activeTab === 'register' || activeTab === 'active' || activeTab === 'discharged') && (
            <PatientsView
              patients={patients}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              dischargedPatientsList={dischargedPatientsList}
              dischargedPatients={dischargedPatientsList}
              dischargedLoading={dischargedLoading}
              dischargedError={dischargedError}
              onRetryDischarged={fetchDischargedPatients}
              onSelectPatient={setSelectedPatient}
              onAdmitPatient={onAdmitPatient}
              onRefresh={() => {
                onRefresh();
                if (activeTab === 'discharged') fetchDischargedPatients();
              }}
            />
          )}

          {/* DISCHARGE REQUESTS QUEUE */}
          {activeTab === 'discharge-queue' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h1 style={{ fontSize: '1.6rem' }}>Discharge Request Queue</h1>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Review doctor-initiated discharge requests. As Receptionist, complete the administrative checklist (identity, doctor request, billing/summary) to authorize formal discharge.
                  </div>
                </div>
                <select
                  className="form-control"
                  style={{ maxWidth: '240px' }}
                  value={dischargeFilter}
                  onChange={(e) => setDischargeFilter(e.target.value)}
                >
                  <option value="PENDING">⏳ Pending Review</option>
                  <option value="RETURNED_FOR_CLARIFICATION">💬 Returned to Doctor</option>
                  <option value="APPROVED">✅ Approved & Discharged</option>
                  <option value="REJECTED">❌ Rejected</option>
                  <option value="ALL">📋 All Requests</option>
                </select>
              </div>

              {/* Feedback Messages */}
              {processingFeedback && (
                <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #34d399', color: '#34d399', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
                  ✓ {processingFeedback.message}
                </div>
              )}
              {processingError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #f87171', color: '#f87171', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
                  ⚠️ {processingError}
                </div>
              )}

              {/* Strict Boundary Explanation */}
              <div style={{ background: 'rgba(6, 182, 212, 0.05)', padding: '14px 18px', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.2)', marginBottom: '20px', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.8' }}>
                <strong style={{ color: 'var(--accent-cyan)' }}>Administrative Operational Boundary:</strong><br/>
                • Clinical assessments are strictly read-only for Receptionists.<br/>
                • Administrative discharge requires completing all 3 mandatory checklist items.<br/>
                • If clinical details require revision, use <strong>Return to Doctor for Clarification</strong> with a specific reason.
              </div>

              {selectedRequest ? (
                /* DETAILED REQUEST REVIEW */
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', color: 'var(--accent-cyan)' }}>Reviewing Discharge Request</h3>
                      <div className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '2px' }}>Request ID: {selectedRequest.id}</div>
                    </div>
                    <button className="btn btn-secondary" onClick={() => { setSelectedRequest(null); resetChecklist(); }} style={{ fontSize: '0.82rem' }}>
                      ← Back to Queue
                    </button>
                  </div>

                  {/* Patient & Doctor Read-Only Information */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>Patient Information (Read-Only)</h4>
                      <div style={{ fontSize: '0.9rem', lineHeight: '1.8' }}>
                        <div><strong>Name:</strong> {selectedRequest.patient_name}</div>
                        <div><strong>Age/Gender:</strong> {selectedRequest.patient_age} / {selectedRequest.patient_gender}</div>
                        <div><strong>Category:</strong> <span style={{ color: 'var(--accent-cyan)' }}>{selectedRequest.emergency_category}</span></div>
                        <div><strong>Room:</strong> {selectedRequest.room_number || 'N/A'}</div>
                        <div><strong>Clinical Risk:</strong> <span style={{ color: selectedRequest.clinical_risk_level === 'CRITICAL' ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>{selectedRequest.clinical_risk_level}</span></div>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>Attending Physician (Read-Only)</h4>
                      <div style={{ fontSize: '0.9rem', lineHeight: '1.8' }}>
                        <div><strong>Doctor:</strong> <span style={{ color: 'var(--accent-emerald)' }}>{selectedRequest.requesting_doctor_name}</span></div>
                        <div><strong>Request Date:</strong> {new Date(selectedRequest.created_at).toLocaleString()}</div>
                        <div><strong>Final Condition:</strong> <span style={{ color: conditionColor(selectedRequest.final_condition), fontWeight: 600 }}>{selectedRequest.final_condition}</span></div>
                        <div><strong>Follow-Up Required:</strong> {selectedRequest.follow_up_required ? '✅ Yes' : '❌ No'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Read-Only Clinical Assessment */}
                  <div style={{ background: 'rgba(16, 185, 129, 0.06)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--accent-emerald)', margin: 0 }}>📋 Clinical Assessment & Notes (Doctor Input — Read-Only)</h4>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px' }}>🔒 Clinical Authority Only</span>
                    </div>
                    <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-main)' }}>
                      {selectedRequest.clinical_assessment}
                    </div>
                  </div>

                  {selectedRequest.discharge_instructions && (
                    <div style={{ background: 'rgba(6, 182, 212, 0.06)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.2)', marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', marginBottom: '8px' }}>📝 Discharge Instructions (Read-Only)</h4>
                      <div style={{ fontSize: '0.88rem', lineHeight: '1.5', color: 'var(--text-main)' }}>
                        {selectedRequest.discharge_instructions}
                      </div>
                    </div>
                  )}

                  {selectedRequest.follow_up_notes && (
                    <div style={{ background: 'rgba(251, 191, 36, 0.06)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(251, 191, 36, 0.2)', marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '0.85rem', color: '#fbbf24', marginBottom: '8px' }}>🔄 Follow-Up Notes (Read-Only)</h4>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>
                        {selectedRequest.follow_up_notes}
                      </div>
                    </div>
                  )}

                  {/* Clarification History if Returned */}
                  {selectedRequest.clarification_reason && (
                    <div style={{ background: 'rgba(236, 72, 153, 0.1)', border: '1px solid #ec4899', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '0.85rem', color: '#ec4899', marginBottom: '4px' }}>💬 Clarification History</h4>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                        <strong>Reason Returned:</strong> {selectedRequest.clarification_reason}
                      </div>
                    </div>
                  )}

                  {/* ACTION SECTION FOR PENDING REQUESTS */}
                  {selectedRequest.status === 'PENDING' && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '20px' }}>
                      <h4 style={{ color: 'var(--accent-cyan)', fontSize: '1.05rem', marginBottom: '14px' }}>
                        📋 Reception Administrative Processing
                      </h4>

                      {/* 3-Item Mandatory Administrative Checklist Card */}
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '10px' }}>
                          Mandatory Administrative Verification Checklist (All 3 required to complete discharge):
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem', color: checklist.identity_verified ? '#10b981' : 'var(--text-main)' }}>
                            <input
                              type="checkbox"
                              checked={checklist.identity_verified}
                              onChange={(e) => setChecklist({ ...checklist, identity_verified: e.target.checked })}
                            />
                            <span>1. <strong>Patient Identity Verified</strong> (Government ID / Hospital Wristband matched)</span>
                          </label>

                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem', color: checklist.doctor_request_reviewed ? '#10b981' : 'var(--text-main)' }}>
                            <input
                              type="checkbox"
                              checked={checklist.doctor_request_reviewed}
                              onChange={(e) => setChecklist({ ...checklist, doctor_request_reviewed: e.target.checked })}
                            />
                            <span>2. <strong>Doctor Discharge Request Reviewed</strong> (Physician assessment and instructions confirmed)</span>
                          </label>

                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem', color: checklist.administrative_summary_completed ? '#10b981' : 'var(--text-main)' }}>
                            <input
                              type="checkbox"
                              checked={checklist.administrative_summary_completed}
                              onChange={(e) => setChecklist({ ...checklist, administrative_summary_completed: e.target.checked })}
                            />
                            <span>3. <strong>Administrative Summary & Billing Completed</strong> (Settlement / Paperwork finalized)</span>
                          </label>
                        </div>
                      </div>

                      {/* Action Cards: Approve / Return to Doctor / Reject */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {/* Approve & Discharge */}
                        <div style={{ background: 'rgba(16, 185, 129, 0.06)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                          <h4 style={{ color: '#10b981', marginBottom: '10px', fontSize: '0.95rem' }}>✅ Complete Administrative Discharge</h4>
                          <div className="form-group">
                            <label style={{ fontSize: '0.82rem' }}>Administrative Notes (Optional)</label>
                            <textarea
                              className="form-control"
                              rows="3"
                              placeholder="Belongings returned, transportation arranged, billing finalized..."
                              value={adminNotes}
                              onChange={(e) => setAdminNotes(e.target.value)}
                              style={{ resize: 'vertical' }}
                            />
                          </div>
                          <button
                            className="btn btn-primary"
                            style={{
                              width: '100%', justifyContent: 'center',
                              backgroundColor: allChecklistItemsChecked ? '#10b981' : '#374151',
                              opacity: allChecklistItemsChecked ? 1 : 0.6,
                              cursor: allChecklistItemsChecked ? 'pointer' : 'not-allowed',
                              fontSize: '0.9rem'
                            }}
                            onClick={handleApprove}
                            disabled={isProcessing || !allChecklistItemsChecked}
                          >
                            {isProcessing ? 'Processing...' : '✅ Complete Administrative Discharge'}
                          </button>
                          {!allChecklistItemsChecked && (
                            <div style={{ fontSize: '0.72rem', color: '#fbbf24', marginTop: '6px', textAlign: 'center' }}>
                              ⚠️ Complete all 3 checklist items above to unlock button
                            </div>
                          )}
                        </div>

                        {/* Return to Doctor for Clarification */}
                        <div style={{ background: 'rgba(236, 72, 153, 0.06)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(236, 72, 153, 0.2)' }}>
                          <h4 style={{ color: '#ec4899', marginBottom: '10px', fontSize: '0.95rem' }}>💬 Return to Doctor for Clarification</h4>
                          <div className="form-group">
                            <label style={{ fontSize: '0.82rem' }}>Clarification Reason *</label>
                            <textarea
                              className="form-control"
                              rows="3"
                              placeholder="Specify missing clinical details, unclear follow-up instructions, or questions for attending doctor..."
                              value={clarificationReason}
                              onChange={(e) => setClarificationReason(e.target.value)}
                              style={{ resize: 'vertical' }}
                            />
                          </div>
                          <button
                            className="btn btn-secondary"
                            style={{ width: '100%', justifyContent: 'center', backgroundColor: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', border: '1px solid #ec4899', fontSize: '0.9rem' }}
                            onClick={handleReturnToDoctor}
                            disabled={isProcessing || !clarificationReason.trim()}
                          >
                            {isProcessing ? 'Processing...' : '💬 Return to Doctor'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Already processed / Returned state */}
                  {selectedRequest.status !== 'PENDING' && (
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '16px' }}>
                      <div style={{ fontSize: '0.9rem' }}>
                        <strong>Current Status:</strong> <span style={{ color: statusColor(selectedRequest.status), fontWeight: 700 }}>{selectedRequest.status}</span>
                      </div>
                      {selectedRequest.reviewed_by && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Reviewed by: {selectedRequest.reviewed_by} at {selectedRequest.reviewed_at ? new Date(selectedRequest.reviewed_at).toLocaleString() : 'N/A'}
                        </div>
                      )}
                      {selectedRequest.rejection_reason && (
                        <div style={{ fontSize: '0.85rem', color: '#f87171', marginTop: '8px' }}>
                          <strong>Rejection Reason:</strong> {selectedRequest.rejection_reason}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* REQUESTS LIST */
                <div className="card">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Request ID</th>
                        <th>Patient</th>
                        <th>Category</th>
                        <th>Requesting Doctor</th>
                        <th>Condition</th>
                        <th>Status</th>
                        <th>Requested At</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.length > 0 ? (
                        filteredRequests.map((dr) => (
                          <tr key={dr.id}>
                            <td className="mono" style={{ color: 'var(--accent-cyan)', fontSize: '0.82rem' }}>{dr.id}</td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{dr.patient_name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dr.patient_age} / {dr.patient_gender}</div>
                            </td>
                            <td><strong style={{ color: 'var(--accent-cyan)' }}>{dr.emergency_category}</strong></td>
                            <td style={{ color: 'var(--accent-emerald)' }}>{dr.requesting_doctor_name}</td>
                            <td>
                              <span style={{ color: conditionColor(dr.final_condition), fontWeight: 600, fontSize: '0.85rem' }}>
                                {dr.final_condition}
                              </span>
                            </td>
                            <td>
                              <span style={{
                                padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700,
                                background: `${statusColor(dr.status)}22`, color: statusColor(dr.status)
                              }}>
                                {dr.status}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                              {new Date(dr.created_at).toLocaleString()}
                            </td>
                            <td>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                                onClick={() => {
                                  setSelectedRequest(dr);
                                  setAdminNotes('');
                                  setRejectionReason('');
                                  setClarificationReason('');
                                  setProcessingError('');
                                  setProcessingFeedback(null);
                                  resetChecklist();
                                }}
                              >
                                {dr.status === 'PENDING' ? '🔍 Review & Complete' : '📄 View Details'}
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                            {dischargeFilter === 'PENDING'
                              ? '✅ No pending discharge requests awaiting review.'
                              : `No ${dischargeFilter.toLowerCase().replace(/_/g, ' ')} discharge requests found.`
                            }
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Patient Detail Modal (Read-Only for Receptionist) */}
      {selectedPatient && (
        <PatientDetailModal
          patientId={typeof selectedPatient === 'object' ? (selectedPatient.id || selectedPatient.patient_id) : selectedPatient}
          token={token}
          onClose={() => setSelectedPatient(null)}
          userRole={user?.role || 'RECEPTIONIST'}
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

