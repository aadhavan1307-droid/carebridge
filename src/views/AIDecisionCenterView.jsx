import React, { useState } from 'react';

export default function AIDecisionCenterView({ decisions = [], onReplan }) {
  const [selectedDecision, setSelectedDecision] = useState(decisions[0] || null);
  const [isReplanning, setIsReplanning] = useState(false);

  const handleRunReplan = async () => {
    setIsReplanning(true);
    await onReplan('MANUAL_COMMAND_CENTER_TRIGGER');
    setIsReplanning(false);
  };

  const parseJsonSafely = (val) => {
    if (typeof val === 'object' && val !== null) return val;
    try {
      return JSON.parse(val);
    } catch {
      return { raw: val };
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem' }}>AI Decision Center & Explainability Inspector</h1>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Inspect Automated Classical AI Search Trajectories, CSP Constraints & Dynamic Replanning Diffs
          </div>
        </div>

        {onReplan && (
          <button className="btn btn-primary" onClick={handleRunReplan} disabled={isReplanning}>
            {isReplanning ? 'Evaluating State...' : '🔄 Execute Dynamic Replanning Evaluation'}
          </button>
        )}
      </div>

      {/* Two Column Layout: Decision List + Decision Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>
        {/* Left: Decisions Log Table */}
        <div className="card">
          <h3 style={{ marginBottom: '14px' }}>Logged AI Decisions ({decisions.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '600px', overflowY: 'auto' }}>
            {decisions.length > 0 ? (
              decisions.map(d => {
                const isSelected = selectedDecision?.id === d.id;
                return (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDecision(d)}
                    style={{
                      padding: '14px',
                      borderRadius: '8px',
                      border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                      backgroundColor: isSelected ? 'rgba(6, 182, 212, 0.1)' : 'rgba(255,255,255,0.02)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                        {d.algorithm_used}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        {new Date(d.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      {d.decision_type}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Patient: {d.patient_name || d.patient_id || 'System State'}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px dashed var(--border-color)' }}>
                No recent AI decisions recorded in database.
              </div>
            )}
          </div>
        </div>

        {/* Right: Detailed Decision Inspector */}
        <div className="card">
          {selectedDecision ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '16px' }}>
                <div>
                  <div className="mono" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>{selectedDecision.id}</div>
                  <h2 style={{ fontSize: '1.2rem', marginTop: '2px' }}>{selectedDecision.decision_type}</h2>
                </div>
                <span className="badge badge-success">{selectedDecision.algorithm_used}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Target Patient:</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                    {selectedDecision.patient_name || selectedDecision.patient_id || 'System State'}
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Objective Score / Cost:</span>
                  <div className="mono" style={{ fontWeight: 600, color: 'var(--accent-emerald)', marginTop: '2px' }}>
                    {selectedDecision.score_cost !== undefined ? selectedDecision.score_cost : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Plain Text Explanation */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)', marginBottom: '8px' }}>💬 Transparent Explanation Rationale</h4>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '14px', borderRadius: '6px', fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-main)' }}>
                  {selectedDecision.explanation_text}
                </div>
              </div>

              {/* Data Object JSON */}
              <div>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-amber)', marginBottom: '8px' }}>🔍 Detailed State & Trajectory Data</h4>
                <div className="trajectory-box">
                  {JSON.stringify(parseJsonSafely(selectedDecision.decision_data_json || selectedDecision.decision_data), null, 2)}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
              {decisions.length > 0 ? 'Select a decision from the left panel to inspect AI search details.' : 'No AI decision selected.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
