import React from 'react';

export default function ResourcesView({ resources }) {
  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.6rem' }}>Critical Medical Resources & Equipment Stock</h1>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Inventory Counts, Active Allocations, Stock Limits & Status Controls
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {resources.map(res => {
          const avail = res.total_count - res.allocated_count;
          const allocPct = Math.round((res.allocated_count / res.total_count) * 100);

          return (
            <div key={res.id} className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>{res.name}</h3>
                  <div className="mono" style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>{res.resource_type}</div>
                </div>
                <span className="badge badge-success">{res.status}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Stock</div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: 700 }}>{res.total_count}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Allocated</div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-amber)' }}>{res.allocated_count}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Available</div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>{avail}</div>
                </div>
              </div>

              {/* Allocation bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <span>Resource Utilization:</span>
                  <span>{allocPct}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${allocPct}%`, backgroundColor: allocPct > 80 ? '#f87171' : 'var(--accent-cyan)' }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
