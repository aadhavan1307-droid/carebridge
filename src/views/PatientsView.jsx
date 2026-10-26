import React, { useState } from 'react';

export default function PatientsView({
  patients = [],
  dischargedPatientsList = [],
  dischargedPatients = [],
  onSelectPatient,
  onAdmitPatient,
  onRefresh,
  activeTab: externalTab,
  onTabChange,
  dischargedError,
  onRetryDischarged
}) {
  const [internalTab, setInternalTab] = useState('active'); // active, add, discharged
  const currentTab = externalTab || internalTab;

  const setTab = (tab) => {
    if (onTabChange) onTabChange(tab);
    setInternalTab(tab);
  };

  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  // Add Patient Form State
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'Male',
    contact: '',
    emergency_category: 'GENERAL',
    consciousness_state: 'ALERT',
    symptoms: '',
    hr: '',
    bp_sys: '',
    bp_dia: '',
    spo2: '',
    resp_rate: '',
    temp: '',
    auto_assign: true
  });

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [admitSuccessMsg, setAdmitSuccessMsg] = useState('');

  const safePatients = Array.isArray(patients) ? patients : (patients?.patients || patients?.data || []);
  const activePatients = safePatients.filter(p => p.status !== 'DISCHARGED');
  const archiveSource = (dischargedPatientsList && dischargedPatientsList.length > 0)
    ? dischargedPatientsList
    : (dischargedPatients && dischargedPatients.length > 0)
      ? dischargedPatients
      : safePatients.filter(p => p.status === 'DISCHARGED');
  const archivedPatients = archiveSource;

  const filteredActive = activePatients.filter(p => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase());
    const matchesPriority = !filterPriority || p.operational_priority_level === filterPriority;
    return matchesSearch && matchesPriority;
  });

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setAdmitSuccessMsg('');

    if (!formData.name || !formData.age || !formData.gender) {
      setFormError('Patient Name, Age, and Gender are required.');
      return;
    }

    setIsSubmitting(true);

    const vitals = {};
    if (formData.hr) vitals.hr = Number(formData.hr);
    if (formData.bp_sys) vitals.bp_sys = Number(formData.bp_sys);
    if (formData.bp_dia) vitals.bp_dia = Number(formData.bp_dia);
    if (formData.spo2) vitals.spo2 = Number(formData.spo2);
    if (formData.resp_rate) vitals.resp_rate = Number(formData.resp_rate);
    if (formData.temp) vitals.temp = Number(formData.temp);

    const payload = {
      name: formData.name,
      age: Number(formData.age),
      gender: formData.gender,
      contact: formData.contact || 'N/A',
      emergency_category: formData.emergency_category,
      consciousness_state: formData.consciousness_state,
      symptoms: formData.symptoms ? formData.symptoms.split(',').map(s => s.trim()) : [],
      vitals,
      auto_assign: formData.auto_assign
    };

    try {
      const res = await onAdmitPatient(payload);
      setIsSubmitting(false);

      setAdmitSuccessMsg(`Patient ${res.patient_id} ${res.status === 'UNDER_CARE' ? 'admitted and allocated' : 'admitted pending allocation'}. Priority: ${res.operational_priority_level} (${res.priority_score}/100).`);
      setFormData({
        name: '', age: '', gender: 'Male', contact: '', emergency_category: 'GENERAL',
        consciousness_state: 'ALERT', symptoms: '', hr: '', bp_sys: '', bp_dia: '',
        spo2: '', resp_rate: '', temp: '', auto_assign: true
      });
      onRefresh();
    } catch (err) {
      setIsSubmitting(false);
      setFormError(err.message || 'Failed to admit patient.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem' }}>Patient Management Center</h1>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Admission, Triage Prioritization, Active Care & Archived Lifecycle
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="tabs-nav" style={{ marginBottom: 0 }}>
          <button className={`tab-btn ${currentTab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
            🏥 Active Patients ({activePatients.length})
          </button>
          <button className={`tab-btn ${currentTab === 'register' || currentTab === 'add' ? 'active' : ''}`} onClick={() => setTab('register')}>
            + Add New Patient (Receptionist)
          </button>
          <button className={`tab-btn ${currentTab === 'discharged' ? 'active' : ''}`} onClick={() => setTab('discharged')}>
            📜 Discharged Archive ({archivedPatients.length})
          </button>
        </div>
      </div>

      {/* TAB 1: ACTIVE PATIENTS */}
      {currentTab === 'active' && (
        <div className="card">
          {/* Filters */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by Patient Name, ID, or Category..."
              style={{ maxWidth: '350px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="form-control"
              style={{ maxWidth: '180px' }}
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value="P1">P1 — Critical</option>
              <option value="P2">P2 — High</option>
              <option value="P3">P3 — Moderate</option>
              <option value="P4">P4 — Low</option>
            </select>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Name / Demographics</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Consciousness</th>
                <th>Assigned Doctor</th>
                <th>Assigned Room</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredActive.length > 0 ? (
                filteredActive.map((p) => {
                  const displayPriority = p.operational_priority_level ?? 'NOT_ASSESSED';
                  return (
                    <tr key={p.id}>
                      <td className="mono" style={{ color: 'var(--accent-cyan)' }}>{p.id}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.age} yrs | {p.gender}</div>
                      </td>
                      <td><strong style={{ color: 'var(--accent-cyan)' }}>{p.emergency_category}</strong></td>
                      <td>
                        <span className={`badge badge-${displayPriority.toLowerCase()}`}>
                          {displayPriority}
                        </span>
                      </td>
                      <td><span style={{ fontSize: '0.82rem', color: 'var(--accent-amber)' }}>{p.consciousness_state || 'ALERT'}</span></td>
                      <td>{p.doctor_name || p.assigned_doctor_id || 'AWAITING'}</td>
                      <td>{p.room_number || p.assigned_room_id || 'AWAITING'}</td>
                      <td>
                        <span className={`badge ${p.status === 'DISCHARGE_REQUESTED' ? 'badge-warning' : p.status === 'RETURNED_FOR_CLARIFICATION' ? 'badge-info' : 'badge-success'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        {p.status === 'DISCHARGE_REQUESTED' ? (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '4px 10px', fontSize: '0.8rem', backgroundColor: '#f59e0b', color: '#000', fontWeight: 600 }}
                            onClick={() => onSelectPatient(p)}
                          >
                            📋 Review Discharge
                          </button>
                        ) : p.status === 'RETURNED_FOR_CLARIFICATION' ? (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.78rem', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.4)' }}
                            onClick={() => onSelectPatient(p)}
                          >
                            ⏳ Awaiting Clarification
                          </button>
                        ) : (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                            onClick={() => onSelectPatient(p)}
                          >
                            👁️ View Patient
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    No active patients matching query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: ADD PATIENT FORM */}
      {(currentTab === 'register' || currentTab === 'add') && (
        <div className="card" style={{ maxWidth: '800px' }}>
          <h3 style={{ marginBottom: '6px' }}>Patient Admission & Triage Registration</h3>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Enter patient clinical details. CareBridge AI will validate input, analyze priority, and automatically assign an appropriate doctor & room.
          </div>

          {formError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #f87171', color: '#f87171', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
              ⚠️ {formError}
            </div>
          )}

          {admitSuccessMsg && (
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #34d399', color: '#34d399', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
              ✓ {admitSuccessMsg}
            </div>
          )}

          <form onSubmit={handleAddSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Patient Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Age *</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="e.g. 54"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Gender *</label>
                <select
                  className="form-control"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Emergency Category</label>
                <select
                  className="form-control"
                  value={formData.emergency_category}
                  onChange={(e) => setFormData({ ...formData, emergency_category: e.target.value })}
                >
                  <option value="CARDIAC">CARDIAC (Chest Pain, Infarction)</option>
                  <option value="TRAUMA">TRAUMA (Fractures, Internal Shock)</option>
                  <option value="NEURO">NEUROLOGY (Stroke, Seizure)</option>
                  <option value="RESPIRATORY">RESPIRATORY (Hypoxia, Asthma)</option>
                  <option value="GENERAL">GENERAL MEDICAL</option>
                </select>
              </div>

              <div className="form-group">
                <label>Consciousness State</label>
                <select
                  className="form-control"
                  value={formData.consciousness_state}
                  onChange={(e) => setFormData({ ...formData, consciousness_state: e.target.value })}
                >
                  <option value="ALERT">ALERT (Fully conscious)</option>
                  <option value="VOICE">VOICE (Responds to speech)</option>
                  <option value="PAIN">PAIN (Responds only to pain)</option>
                  <option value="UNRESPONSIVE">UNRESPONSIVE (Comatose / Critical)</option>
                  <option value="NOT_ASSESSED">NOT_ASSESSED (Controlled triage state)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Heart Rate (bpm)</label>
                  <input type="number" className="form-control" placeholder="e.g. 110" value={formData.hr} onChange={(e) => setFormData({ ...formData, hr: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Blood Pressure Sys (mmHg)</label>
                  <input type="number" className="form-control" placeholder="e.g. 130" value={formData.bp_sys} onChange={(e) => setFormData({ ...formData, bp_sys: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>SpO2 Saturation (%)</label>
                  <input type="number" className="form-control" placeholder="e.g. 92" value={formData.spo2} onChange={(e) => setFormData({ ...formData, spo2: e.target.value })} />
                </div>
            </div>

            <div className="form-group">
              <label>Symptoms (Comma-separated)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. ST-elevation, chest pain, hypotension"
                value={formData.symptoms}
                onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
                <input
                  type="checkbox"
                  checked={formData.auto_assign}
                  onChange={(e) => setFormData({ ...formData, auto_assign: e.target.checked })}
                />
                Automatically Execute AI Doctor & Room Assignment
              </label>

              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Admitting...' : 'Submit Patient Admission & Run AI Triage'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: DISCHARGED PATIENTS ARCHIVE */}
      {currentTab === 'discharged' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3>Discharged Patients Archive</h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Historical record of all discharged patients. Preserves clinical history, AI decisions, and length of stay while excluded from active operational hospital state.
              </div>
            </div>
            {onRetryDischarged && (
              <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={onRetryDischarged}>
                🔄 Refresh Archive
              </button>
            )}
          </div>

          {dischargedError ? (
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #f87171', color: '#f87171', padding: '16px', borderRadius: '8px', textAlign: 'center', margin: '20px 0' }}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>⚠️ Unable to load discharged records.</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>{dischargedError}</div>
              {onRetryDischarged && (
                <button className="btn btn-primary" style={{ backgroundColor: '#ef4444', fontSize: '0.82rem' }} onClick={onRetryDischarged}>
                  🔄 RETRY
                </button>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Patient Name</th>
                  <th>Demographics</th>
                  <th>Category</th>
                  <th>Attending Doctor</th>
                  <th>Admission Date</th>
                  <th>Discharge Date</th>
                  <th>Discharge Reason / Summary</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {archivedPatients.length > 0 ? (
                  archivedPatients.map((p) => (
                    <tr key={p.id}>
                      <td className="mono" style={{ color: 'var(--accent-emerald)', fontSize: '0.82rem' }}>{p.id}</td>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.age} yrs | {p.gender}</div>
                      </td>
                      <td><strong style={{ color: 'var(--accent-cyan)' }}>{p.emergency_category}</strong></td>
                      <td>{p.assigned_doctor_name || p.discharged_by_doctor || p.doctor_name || 'Dr. Attending'}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        {p.admitted_at || p.admission_time ? new Date(p.admitted_at || p.admission_time).toLocaleString() : 'N/A'}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        {p.discharged_at || p.discharge?.discharged_at ? new Date(p.discharged_at || p.discharge.discharged_at).toLocaleString() : 'Archived'}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '200px' }}>
                        {p.clinical_summary || p.discharge?.summary || 'Outpatient clearance'}
                      </td>
                      <td>
                        <span className="badge badge-secondary" style={{ background: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af' }}>
                          {p.status || 'DISCHARGED'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                          onClick={() => onSelectPatient(p)}
                        >
                          📄 VIEW RECORD
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                      No discharged patients found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

