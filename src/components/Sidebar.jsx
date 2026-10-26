import React from 'react';

export default function Sidebar({ activeView, setActiveView, counts = {} }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'patients', label: 'Patients', icon: '🏥', count: counts.patients },
    { id: 'doctors', label: 'Doctors', icon: '🩺', count: counts.doctors },
    { id: 'rooms', label: 'Rooms & Beds', icon: '🛏️', count: counts.rooms },
    { id: 'resources', label: 'Resources', icon: '📦' },
    { id: 'ai-center', label: 'AI Decision Center', icon: '🧠', count: counts.aiDecisions },
    { id: 'alerts', label: 'Alerts & Conflicts', icon: '⚠️', count: counts.conflicts, alert: counts.conflicts > 0 },
    { id: 'analytics', label: 'Analytics & ML', icon: '📈' },
    { id: 'audit', label: 'Audit History', icon: '📜' },
    { id: 'admin', label: 'Administration', icon: '⚙️' },
    { id: 'settings', label: 'Settings', icon: '🛠️' }
  ];

  return (
    <aside className="sidebar">
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Hospital Operations
        </div>
        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent-cyan)', marginTop: '2px' }}>
          Command Center 2.0
        </div>
      </div>

      <nav style={{ padding: '12px', overflowY: 'auto', flex: 1 }}>
        {menuItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                marginBottom: '4px',
                borderRadius: '6px',
                border: 'none',
                background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 400,
                fontSize: '0.9rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && item.count !== null && (
                <span style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: item.alert ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                  color: item.alert ? '#f87171' : 'var(--text-muted)'
                }}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', fontSize: '0.73rem', color: 'var(--text-dim)', lineHeight: '1.5' }}>
        <div style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>CareBridge 2.0</div>
        <div>Human-Centered Emergency Care</div>
        <div>Intelligent Resource Allocation</div>
      </div>
    </aside>
  );
}
