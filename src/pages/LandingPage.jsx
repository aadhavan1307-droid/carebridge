import React from 'react';

export default function LandingPage({ onSelectLogin }) {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-dark)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{ textAlign: 'center', maxWidth: '700px', marginBottom: '40px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '10px' }}>⚡</div>
        <h1 style={{ fontSize: '2.5rem', fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '8px' }}>
          CAREBRIDGE 2.0
        </h1>
        <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-cyan)', fontWeight: 500, marginBottom: '16px' }}>
          Human-Centered Emergency Care & Classical AI
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6' }}>
          Hospital Emergency Care Coordination & Intelligent Resource Allocation Platform.
          Please select your authorized clinical operational workspace to authenticate.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', width: '100%', maxWidth: '900px' }}>
        {/* Reception Login Card */}
        <div className="card" style={{ textAlign: 'center', padding: '30px 24px', borderTop: '4px solid var(--accent-cyan)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📋</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Reception & Intake</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', minHeight: '40px' }}>
            Patient intake, triage registration, demographic validation, and admission clearance.
          </p>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onSelectLogin('reception')}>
            [ RECEPTION / FRONT DESK LOGIN ]
          </button>
        </div>

        {/* Doctor Login Card */}
        <div className="card" style={{ textAlign: 'center', padding: '30px 24px', borderTop: '4px solid var(--accent-emerald)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🩺</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Clinical Workspace</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', minHeight: '40px' }}>
            Clinical patient management, observation recording, automatic reassessment, and risk tracking.
          </p>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', backgroundColor: 'var(--accent-emerald)' }} onClick={() => onSelectLogin('doctor')}>
            [ DOCTOR / CLINICAL LOGIN ]
          </button>
        </div>

        {/* Admin Login Card */}
        <div className="card" style={{ textAlign: 'center', padding: '30px 24px', borderTop: '4px solid var(--accent-purple)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🏛️</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Hospital Operations</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', minHeight: '40px' }}>
            Full hospital command center, staff/room/resource capacity, AI search, and analytics.
          </p>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', backgroundColor: 'var(--accent-purple)' }} onClick={() => onSelectLogin('admin')}>
            [ ADMINISTRATOR LOGIN ]
          </button>
        </div>
      </div>
    </div>
  );
}
