import React, { useState, useEffect } from 'react';

export default function AnalyticsView() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('carebridge_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    fetch('/api/analytics', { headers })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        setAnalytics(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Loading analytics & ML evaluation models...</div>;
  }

  const ml = analytics?.ml_models || {};
  const models = ml.models || [];

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.6rem' }}>Analytics & Machine Learning Science Suite</h1>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Real Stored System Event Metrics & Predictive Patient Risk Model Performance Benchmarking
        </div>
      </div>

      {/* Model Benchmark Performance Cards */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, color: 'var(--accent-cyan)' }}>🤖 Machine Learning Model Performance Comparison</h3>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', border: '1px solid #fbbf24', padding: '2px 8px', borderRadius: '4px' }}>
          ⚠️ SYNTHETIC / TEST DATA BENCHMARK
        </span>
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        Evaluated on {ml.dataset_size || 300} synthetic clinical feature vectors. Target: High Deterioration Risk Prediction.
      </div>

      <div className="card" style={{ marginBottom: '30px' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Model Algorithm</th>
              <th>Accuracy</th>
              <th>Precision</th>
              <th>Recall</th>
              <th>F1 Score</th>
              <th>ROC-AUC</th>
              <th>Latency (ms)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {models.map(m => {
              const isBest = m.name === ml.best_model;
              return (
                <tr key={m.name} style={{ background: isBest ? 'rgba(16, 185, 129, 0.08)' : 'transparent' }}>
                  <td style={{ fontWeight: 600, color: isBest ? '#34d399' : 'var(--text-main)' }}>
                    {m.name} {isBest && '🏆'}
                  </td>
                  <td className="mono">{(m.accuracy * 100).toFixed(1)}%</td>
                  <td className="mono">{(m.precision * 100).toFixed(1)}%</td>
                  <td className="mono">{(m.recall * 100).toFixed(1)}%</td>
                  <td className="mono" style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{(m.f1_score * 100).toFixed(1)}%</td>
                  <td className="mono" style={{ fontWeight: 700, color: 'var(--accent-purple)' }}>{m.roc_auc.toFixed(3)}</td>
                  <td className="mono" style={{ color: 'var(--text-dim)' }}>{m.inference_time_ms} ms</td>
                  <td>
                    <span className={`badge ${isBest ? 'badge-success' : 'badge-secondary'}`}>
                      {isBest ? 'BEST FIT' : 'EVALUATED'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Hospital Throughput Summary */}
      <h3 style={{ marginBottom: '14px', color: 'var(--accent-emerald)' }}>📈 Operational Throughput Metrics</h3>
      <div className="grid-metrics">
        <div className="card metric-card">
          <div>
            <div className="metric-label">Avg Wait Time</div>
            <div className="metric-value" style={{ color: 'var(--accent-cyan)' }}>
              {analytics?.throughput?.avg_wait_time_mins != null
                ? `${analytics.throughput.avg_wait_time_mins} mins`
                : (analytics?.throughput?.wait_time_status || 'NO DATA')}
            </div>
          </div>
          <span style={{ fontSize: '2rem' }}>⏱️</span>
        </div>

        <div className="card metric-card">
          <div>
            <div className="metric-label">Total Admissions</div>
            <div className="metric-value" style={{ color: 'var(--accent-emerald)' }}>
              {analytics?.throughput?.total_admissions ?? 0}
            </div>
          </div>
          <span style={{ fontSize: '2rem' }}>📥</span>
        </div>

        <div className="card metric-card">
          <div>
            <div className="metric-label">Total Discharges</div>
            <div className="metric-value" style={{ color: 'var(--accent-purple)' }}>
              {analytics?.throughput?.total_discharges ?? 0}
            </div>
          </div>
          <span style={{ fontSize: '2rem' }}>📤</span>
        </div>

        <div className="card metric-card">
          <div>
            <div className="metric-label">ICU Utilization</div>
            <div className="metric-value" style={{ color: 'var(--accent-amber)' }}>
              {analytics?.throughput?.icu_utilization_rate != null
                ? `${analytics.throughput.icu_utilization_rate}%`
                : (analytics?.throughput?.icu_status || 'ICU NOT CONFIGURED')}
            </div>
          </div>
          <span style={{ fontSize: '2rem' }}>📊</span>
        </div>
      </div>
    </div>
  );
}
