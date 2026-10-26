import React from 'react';

export default function AlertsConflictsView({ conflicts = [], onReplan }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem' }}>Alerts & Conflict Resolution Center</h1>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Real-Time Resource Shortage Detection, Infeasible Constraint Monitoring & Replanning Triggers
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => onReplan('CONFLICT_RESOLUTION_TRIGGER')}>
          ⚡ Run AI Conflict Replanning
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {conflicts.length > 0 ? (
          conflicts.map(c => {
            const isCritical = c.severity === 'CRITICAL';
            return (
              <div
                key={c.id}
                className="card"
                style={{
                  borderLeft: isCritical ? '4px solid #ef4444' : '4px solid #f59e0b',
                  padding: '20px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.4rem' }}>{isCritical ? '🚨' : '⚠️'}</span>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', color: isCritical ? '#f87171' : '#fbbf24' }}>
                        {c.conflict_type}
                      </h3>
                      <div className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        ID: {c.id} | Detected: {new Date(c.detected_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <span className={`badge ${isCritical ? 'badge-p1' : 'badge-warning'}`}>
                    {c.severity}
                  </span>
                </div>

                <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '14px', lineHeight: '1.5' }}>
                  {c.description}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem' }} onClick={() => onReplan('MANUAL_RESOLVE')}>
                    Trigger Replanner
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            ✓ No active allocation conflicts detected in the system.
          </div>
        )}
      </div>
    </div>
  );
}
