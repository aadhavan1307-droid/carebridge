import React, { useState } from 'react';

export default function AdministrationView() {
  const [weights, setWeights] = useState({
    g_weight: 1.0,
    h_weight: 1.2,
    workload_weight: 2.0,
    wait_penalty: 5.0,
    human_oversight: false
  });

  const [savedMsg, setSavedMsg] = useState('');

  const handleSave = (e) => {
    e.preventDefault();
    setSavedMsg('System configuration and AI algorithm objective weights updated successfully.');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.6rem' }}>Administrative System Configuration</h1>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Configure Hospital Rules, Priority Risk Thresholds & Classical AI Search Objective Weights
        </div>
      </div>

      {savedMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #34d399', color: '#34d399', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>
          ✓ {savedMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left: AI Objective Weight Sliders */}
        <div className="card">
          <h3 style={{ marginBottom: '14px', color: 'var(--accent-cyan)' }}>🧠 A* & CSP Search Objective Weights</h3>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>g(n) Accumulated Cost Weight</span>
                <span className="mono" style={{ color: 'var(--accent-cyan)' }}>{weights.g_weight}</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={weights.g_weight}
                onChange={(e) => setWeights({ ...weights, g_weight: parseFloat(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>h(n) Admissible Heuristic Weight</span>
                <span className="mono" style={{ color: 'var(--accent-cyan)' }}>{weights.h_weight}</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={weights.h_weight}
                onChange={(e) => setWeights({ ...weights, h_weight: parseFloat(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Doctor Workload Variance Penalty Weight</span>
                <span className="mono" style={{ color: 'var(--accent-amber)' }}>{weights.workload_weight}</span>
              </label>
              <input
                type="range"
                min="1.0"
                max="5.0"
                step="0.5"
                value={weights.workload_weight}
                onChange={(e) => setWeights({ ...weights, workload_weight: parseFloat(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '12px' }}>
              Save AI Weights & Config
            </button>
          </form>
        </div>

        {/* Right: Clinical Safety & Human Oversight Policy */}
        <div className="card">
          <h3 style={{ marginBottom: '14px', color: 'var(--accent-emerald)' }}>🛡️ Safety Positioning & Oversight Policy</h3>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '20px' }}>
            CareBridge 2.0 provides classical AI decision support and real-time clinical resource optimization. All AI allocation recommendations are advisory and support clinical leadership.
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={weights.human_oversight}
                onChange={(e) => setWeights({ ...weights, human_oversight: e.target.checked })}
              />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Require Mandatory Human Clinical Sign-off</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  When enabled, AI allocations require a qualified doctor or admin to confirm recommendations before locking room/resource status.
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
