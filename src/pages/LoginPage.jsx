import React, { useState } from 'react';

export default function LoginPage({ loginRole, onLoginSuccess, onBack }) {
  const roleConfigs = {
    reception: {
      title: 'PATIENT INTAKE & RECEPTION LOGIN',
      label: 'Authorized Email / Username',
      defaultEmail: 'reception@carebridge.local',
      defaultPass: 'Reception@2026!',
      color: 'var(--accent-cyan)',
      demoAccounts: [
        { id: 'reception@carebridge.local', label: 'Receptionist' }
      ]
    },
    doctor: {
      title: 'SHARED CLINICAL WORKSPACE LOGIN',
      label: 'Doctor ID / Email / Username',
      defaultEmail: 'DOC-101',
      defaultPass: 'doctor123',
      color: 'var(--accent-emerald)',
      demoAccounts: [
        { id: 'DOC-101', label: 'Dr. Sarah Lin (Cardiology)' },
        { id: 'DOC-102', label: 'Dr. Marcus Vance (Emergency Medicine)' },
        { id: 'DOC-103', label: 'Dr. Elena Rostova (Neurology)' },
        { id: 'DOC-104', label: 'Dr. James Chen (Pulmonology)' },
        { id: 'DOC-105', label: 'Dr. Aris Thorne (General Surgery)' }
      ]
    },
    admin: {
      title: 'HOSPITAL OPERATIONS COMMAND CENTER LOGIN',
      label: 'Authorized Email / Username',
      defaultEmail: 'admin@carebridge.local',
      defaultPass: 'Admin@2026!',
      color: 'var(--accent-purple)',
      demoAccounts: [
        { id: 'admin@carebridge.local', label: 'Administrator' }
      ]
    }
  };

  const config = roleConfigs[loginRole] || roleConfigs.reception;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, password })
      });
      const responseText = await res.text();
      let data = {};
      if (responseText.trim()) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = { error: responseText.trim() };
        }
      }

      if (!res.ok) {
        throw new Error(data.error || `Login request failed with HTTP ${res.status}.`);
      }

      if (!data.token || !data.user) {
        throw new Error('Login service returned an incomplete response. Ensure the backend is running on port 3001.');
      }

      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setLoading(false);
      setError(err instanceof TypeError
        ? 'Unable to reach the login service. Start the backend with npm start on port 3001.'
        : err.message);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '32px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '16px' }}>
          ← Back to Workspace Select
        </button>

        <div style={{ fontSize: '0.75rem', color: config.color, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
          CAREBRIDGE 2.0
        </div>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '20px' }}>{config.title}</h2>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #f87171', color: '#f87171', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '16px' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{config.label}</label>
            <input
              type="text"
              className="form-control"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. DOC-101 or email@carebridge.local"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter account password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', backgroundColor: config.color, marginTop: '12px' }} disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In to Authorized Workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
