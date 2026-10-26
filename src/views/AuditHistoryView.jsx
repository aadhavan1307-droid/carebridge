import React, { useState, useEffect, useRef, useCallback } from "react";

const EVENT_BADGE_COLORS = {
  USER_LOGIN: "#10b981",
  USER_LOGOUT: "#6b7280",
  PATIENT_ADMITTED: "#3b82f6",
  CLINICAL_RISK_ASSESSED: "#f59e0b",
  DISCHARGE_REQUEST_CREATED: "#8b5cf6",
  DISCHARGE_APPROVED: "#10b981",
  DISCHARGE_REQUEST_RETURNED: "#ef4444",
  DISCHARGE_REQUEST_RESUBMITTED: "#f59e0b",
  DISCHARGE_REQUEST_CANCELLED: "#6b7280",
  ADMIN_CREATED_DOCTOR_ACCOUNT: "#06b6d4",
  ADMIN_UPDATED_DOCTOR_ACCOUNT: "#06b6d4",
  REPLAN_TRIGGERED: "#f97316",
};

function getBadgeColor(t) { return EVENT_BADGE_COLORS[t] || "#64748b"; }

function formatPayload(p) {
  if (!p || typeof p !== "object") return "-";
  const e = Object.entries(p);
  if (e.length === 0) return "{}";
  return e.map(([k, v]) => `${k}: ${v}`).join(" | ");
}

const PAGE_SIZE = 20;

export default function AuditHistoryView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState("");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [liveUpdates, setLiveUpdates] = useState(true);

  const fetchLogs = useCallback(async () => {
    const token = localStorage.getItem("carebridge_token");
    if (!token) { setError("Authentication required."); setLoading(false); return; }
    try {
      const res = await fetch("/api/audit", { headers: { "Authorization": `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) {
        setError("Access denied. Audit History requires Administrator role.");
        setLoading(false); return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Server error" }));
        setError(body.error || `Server returned ${res.status}`);
        setLoading(false); return;
      }
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError("Network error: Could not reach CareBridge server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (!liveUpdates) return;
    const token = localStorage.getItem("carebridge_token");
    const es = new EventSource(token ? `/api/events?token=${token}` : "/api/events");
    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.eventType === "AUDIT_LOG_ADDED") {
          setLogs(prev => [{
            id: parsed.payload.id, event_type: parsed.payload.eventType,
            actor_role: parsed.payload.actorRole, payload: parsed.payload.payload,
            timestamp: parsed.timestamp
          }, ...prev]);
        }
      } catch (_) {}
    };
    es.onerror = () => { es.close(); };
    return () => { es.close(); };
  }, [liveUpdates]);

  const safeLogs = Array.isArray(logs) ? logs : [];
  const filtered = safeLogs.filter(l => {
    const mt = !filterType || l.event_type === filterType;
    const ms = !searchText || [l.event_type, l.actor_role, l.id, JSON.stringify(l.payload || {})].some(s => (s || "").toLowerCase().includes(searchText.toLowerCase()));
    return mt && ms;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const eventTypes = [...new Set(safeLogs.map(l => l.event_type))].filter(Boolean);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", margin: 0 }}>Immutable Audit &amp; Decision History</h1>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Complete traceable event log - {safeLogs.length} total records
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "6px", fontSize: "0.78rem",
            color: liveUpdates ? "#10b981" : "var(--text-muted)",
            cursor: "pointer", padding: "6px 10px",
            border: "1px solid var(--border-color, #334155)", borderRadius: "6px",
            background: "var(--card-bg, rgba(30,41,59,0.8))"
          }} onClick={() => setLiveUpdates(v => !v)}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", display: "inline-block", background: liveUpdates ? "#10b981" : "#6b7280", boxShadow: liveUpdates ? "0 0 6px #10b981" : "none" }} />
            {liveUpdates ? "Live" : "Paused"}
          </div>
          <button className="btn btn-secondary" style={{ fontSize: "0.82rem", padding: "6px 14px" }}
            onClick={() => { setLoading(true); fetchLogs(); }}>
            Refresh
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <input type="text" className="form-control"
          placeholder="Search events, roles, IDs..."
          value={searchText} onChange={e => { setSearchText(e.target.value); setPage(1); }}
          style={{ flex: "1", minWidth: "200px", maxWidth: "360px" }}
        />
        <select className="form-control" style={{ maxWidth: "280px" }}
          value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
          <option value="">All Event Types ({safeLogs.length})</option>
          {eventTypes.map(t => (
            <option key={t} value={t}>{t} ({safeLogs.filter(l => l.event_type === t).length})</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="card" style={{ padding: "24px", textAlign: "center", borderColor: "#ef4444", marginBottom: "16px" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>Warning</div>
          <div style={{ color: "#ef4444", fontWeight: "600", marginBottom: "8px" }}>{error}</div>
          <button className="btn btn-primary" onClick={() => { setLoading(true); setError(null); fetchLogs(); }}>Try Again</button>
        </div>
      )}

      {!error && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              Loading audit log history...
            </div>
          ) : (
            <>
              <table className="data-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ width: "180px" }}>Audit ID</th>
                    <th style={{ width: "240px" }}>Event Type</th>
                    <th style={{ width: "140px" }}>Actor Role</th>
                    <th>Payload Details</th>
                    <th style={{ width: "160px" }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length > 0 ? paginated.map(l => (
                    <tr key={l.id}>
                      <td className="mono" style={{ fontSize: "0.78rem", color: "var(--accent-cyan)" }}>{l.id}</td>
                      <td>
                        <span style={{
                          display: "inline-block", fontSize: "0.7rem", fontWeight: "700",
                          padding: "3px 8px", borderRadius: "4px",
                          background: `${getBadgeColor(l.event_type)}22`,
                          color: getBadgeColor(l.event_type),
                          border: `1px solid ${getBadgeColor(l.event_type)}44`,
                          whiteSpace: "nowrap"
                        }}>{l.event_type}</span>
                      </td>
                      <td><strong style={{ fontSize: "0.82rem", color: "var(--accent-amber)" }}>{l.actor_role}</strong></td>
                      <td className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)", maxWidth: "380px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={JSON.stringify(l.payload)}>
                        {formatPayload(l.payload)}
                      </td>
                      <td style={{ fontSize: "0.78rem", color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                        {new Date(l.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                        {searchText || filterType ? "No records match your search/filter." : "No audit records yet. Actions performed in CareBridge will appear here."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: "1px solid var(--border-color, #334155)", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  <span>Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: "0.8rem" }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                    <span style={{ padding: "4px 8px", alignSelf: "center" }}>{page} / {totalPages}</span>
                    <button className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: "0.8rem" }} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
