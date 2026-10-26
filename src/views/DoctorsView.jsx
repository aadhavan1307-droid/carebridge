import React, { useState } from 'react';

export default function DoctorsView({ doctors }) {
  const [specialtyFilter, setSpecialtyFilter] = useState('');

  const filteredDoctors = doctors.filter(d => !specialtyFilter || d.specialty === specialtyFilter);

  const specialties = Array.from(new Set(doctors.map(d => d.specialty)));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem' }}>Doctor Staff Management</h1>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Medical Specialists, Shift Capacity & Active Workload Distribution
          </div>
        </div>

        <select
          className="form-control"
          style={{ maxWidth: '220px' }}
          value={specialtyFilter}
          onChange={(e) => setSpecialtyFilter(e.target.value)}
        >
          <option value="">All Specialties ({doctors.length})</option>
          {specialties.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Doctor Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {filteredDoctors.map(doc => {
          const loadPct = Math.round((doc.current_load / doc.max_capacity) * 100);
          const isAtCapacity = doc.current_load >= doc.max_capacity;

          return (
            <div key={doc.id} className="card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-main)' }}>{doc.name}</div>
                  <div className="mono" style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>{doc.id}</div>
                </div>
                <span className={`badge ${doc.availability_status === 'AVAILABLE' ? 'badge-success' : 'badge-warning'}`}>
                  {doc.availability_status}
                </span>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Specialty: <strong style={{ color: 'var(--text-main)' }}>{doc.specialty}</strong> | Exp: {doc.experience_years} yrs
              </div>

              {/* Workload Progress Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Current Workload Load:</span>
                  <span className="mono" style={{ fontWeight: 600, color: isAtCapacity ? '#f87171' : 'var(--text-main)' }}>
                    {doc.current_load} / {doc.max_capacity} Patients ({loadPct}%)
                  </span>
                </div>

                <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${loadPct}%`,
                      backgroundColor: isAtCapacity ? '#f87171' : loadPct > 60 ? 'var(--accent-amber)' : 'var(--accent-emerald)',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
