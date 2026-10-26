import React from 'react';

export default function SettingsView({ user }) {
  const roleName = user?.role === 'ADMIN' ? 'ADMINISTRATOR' : (user?.role || 'ADMINISTRATOR');

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.6rem' }}>System Settings & Account Diagnostics</h1>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Authenticated User Session & Server-Enforced RBAC Capabilities
        </div>
      </div>

      <div style={{ maxWidth: '640px' }}>
        <div className="card">
          <h3 style={{ marginBottom: '14px', color: 'var(--accent-cyan)' }}>👤 Authenticated User & Permissions</h3>
          
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '6px', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
              {user?.name || 'Authenticated User'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              {user?.email || 'user@carebridge.local'}
            </div>
            <div>
              <span className="badge badge-success" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                SERVER-VERIFIED ROLE: {roleName}
              </span>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '6px', fontSize: '0.85rem', lineHeight: '1.6' }}>
            <strong style={{ color: 'var(--accent-cyan)' }}>Server-Enforced Role Capabilities:</strong>
            {roleName === 'RECEPTIONIST' && (
              <ul style={{ paddingLeft: '18px', marginTop: '6px', color: 'var(--text-muted)' }}>
                <li>Admit new patients & input initial vitals</li>
                <li>View active & discharged patient listings</li>
                <li>Search & inspect basic patient profiles</li>
                <li>Complete administrative discharges when authorized</li>
              </ul>
            )}
            {roleName === 'DOCTOR' && (
              <ul style={{ paddingLeft: '18px', marginTop: '6px', color: 'var(--text-muted)' }}>
                <li>View assigned patients & clinical measurements</li>
                <li>View AI decision rationale & factor explanations</li>
                <li>Update patient care status & submit clinical risk assessments</li>
                <li>Submit & resubmit discharge requests</li>
              </ul>
            )}
            {roleName === 'ADMINISTRATOR' && (
              <ul style={{ paddingLeft: '18px', marginTop: '6px', color: 'var(--text-muted)' }}>
                <li>Full access to operational views & decision center</li>
                <li>Manage Doctors, Rooms, and Resource stock</li>
                <li>Configure AI algorithm parameters & trigger replanning</li>
                <li>Audit System Activity & Execution History</li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
