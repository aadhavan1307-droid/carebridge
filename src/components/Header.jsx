import React, { useState, useEffect } from 'react';

export default function Header({ activeRole, setActiveRole, sseConnected, activeConflictsCount }) {
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.4rem' }}>⚡</span>
          <div>
            <h2 style={{ fontSize: '1.1rem', letterSpacing: '0.5px' }}>CAREBRIDGE 2.0</h2>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Human-Centered Emergency Care & Classical AI
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {/* SSE Live Connection Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            backgroundColor: sseConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)'
          }}></span>
          <span>{sseConnected ? 'LIVE FEED' : 'DISCONNECTED'}</span>
        </div>

        {/* Active Conflict Alert Indicator */}
        {activeConflictsCount > 0 && (
          <div className="badge badge-p1" style={{ cursor: 'pointer' }}>
            ⚠️ {activeConflictsCount} ACTIVE CONFLICTS
          </div>
        )}

        {/* Role Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ROLE:</span>
          <select
            value={activeRole}
            onChange={(e) => setActiveRole(e.target.value)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-cyan)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="RECEPTIONIST" style={{ background: '#0f172a', color: '#fff' }}>RECEPTIONIST / FRONT DESK</option>
            <option value="DOCTOR" style={{ background: '#0f172a', color: '#fff' }}>DOCTOR / CLINICAL USER</option>
            <option value="ADMIN" style={{ background: '#0f172a', color: '#fff' }}>ADMINISTRATOR</option>
          </select>
        </div>

        {/* Live System Time */}
        <div className="mono" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          ⏱️ {time}
        </div>
      </div>
    </header>
  );
}
