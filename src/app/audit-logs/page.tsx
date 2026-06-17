"use client";

import { useEffect, useState } from "react";

interface AuditLog {
  id: string;
  actor: string;
  action: string;
  object: string;
  beforeSnapshot: string | null;
  afterSnapshot: string | null;
  timestamp: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering states
  const [search, setSearch] = useState("");
  const [actor, setActor] = useState("all");
  const [action, setAction] = useState("all");
  
  // Unique actors and actions for dropdowns
  const [uniqueActors, setUniqueActors] = useState<string[]>([]);
  const [uniqueActions, setUniqueActions] = useState<string[]>([]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("format", "json");
      if (actor !== "all") params.set("actor", actor);
      if (action !== "all") params.set("action", action);
      if (search.trim()) params.set("search", search);

      const res = await fetch(`/api/exports/audit-logs?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
        
        // Extract unique actors/actions for filter lists on initial load only
        if (uniqueActors.length === 0) {
          const actors = Array.from(new Set(data.logs.map((l: AuditLog) => l.actor))) as string[];
          const actions = Array.from(new Set(data.logs.map((l: AuditLog) => l.action))) as string[];
          setUniqueActors(actors);
          setUniqueActions(actions);
        }
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Search is submitted explicitly via Enter to avoid refetching on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor, action]); // Trigger fetch on select filter changes

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      fetchLogs();
    }
  };

  const getExportUrl = () => {
    const params = new URLSearchParams();
    if (actor !== "all") params.set("actor", actor);
    if (action !== "all") params.set("action", action);
    if (search.trim()) params.set("search", search);
    return `/api/exports/audit-logs?${params.toString()}`;
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 className="page-title">Supervisory Audit Trail</h1>
          <p className="page-subtitle">
            Regulatory compliance log recording all CRUD actions, manual reviewer overrides, and AI metadata ingestion events under DORA Articles 30 & 31.
          </p>
        </div>
        <a 
          href={getExportUrl()}
          className="btn btn-primary"
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ width: "1.1rem", height: "1.1rem" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export filtered Logs
        </a>
      </div>

      {/* Filter Cockpit Card */}
      <div className="card" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 0.4fr", gap: "1rem", alignItems: "end" }}>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search Object or Snapshot Context</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                className="form-control"
                placeholder="Press Enter to search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyPress}
              />
              <button onClick={fetchLogs} className="btn btn-secondary">Search</button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Filter by Actor</label>
            <select
              className="form-control"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
            >
              <option value="all">All Actors</option>
              {uniqueActors.map((act) => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Filter by Action</label>
            <select
              className="form-control"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="all">All Actions</option>
              {uniqueActions.map((act) => (
                <option key={act} value={act}>{act.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={() => { setSearch(""); setActor("all"); setAction("all"); }} 
            className="btn btn-secondary" 
            style={{ width: "100%" }}
          >
            Reset
          </button>

        </div>
      </div>

      {/* Log list Card */}
      <div className="card">
        <h2 style={{ fontSize: "1.2rem", marginBottom: "1.25rem" }}>Logged Events ({logs.length})</h2>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
            <div className="spinner" />
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "var(--text-muted)" }}>
            No actions match the filter criteria. Actions like imports, reviews, and remediation resolutions will register here.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {logs.map((log) => {
              const formattedDate = new Date(log.timestamp).toLocaleString("de-DE", {
                timeZone: "UTC",
                dateStyle: "medium",
                timeStyle: "medium",
              });

              // Format action tags
              let actionBadgeColor = "var(--color-info)";
              if (log.action.includes("RESOLVE") || log.action.includes("APPROVE")) {
                actionBadgeColor = "var(--color-brand)";
              } else if (log.action.includes("EXTRACT") || log.action.includes("IMPORT") || log.action.includes("COMPILE")) {
                actionBadgeColor = "var(--color-warning)";
              } else if (log.action.includes("DELETE") || log.action.includes("OVERRIDE")) {
                actionBadgeColor = "var(--color-error)";
              }

              return (
                <div
                  key={log.id}
                  style={{
                    backgroundColor: "rgba(22, 28, 41, 0.35)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: `${actionBadgeColor}22`,
                          color: actionBadgeColor,
                          border: `1px solid ${actionBadgeColor}`,
                          fontWeight: 600,
                          fontSize: "0.75rem",
                        }}
                      >
                        {log.action}
                      </span>
                      <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        Target: {log.object}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {formattedDate} UTC
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    <span>
                      Actor: <strong style={{ color: "var(--text-primary)" }}>{log.actor}</strong>
                    </span>
                    <span>&middot;</span>
                    <span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>ID: {log.id.slice(0, 8)}...</span>
                  </div>

                  {/* Collapsible detail snapshot viewer */}
                  {(log.beforeSnapshot || log.afterSnapshot) && (
                    <details style={{ marginTop: "0.25rem" }}>
                      <summary
                        style={{
                          cursor: "pointer",
                          fontSize: "0.75rem",
                          color: "var(--color-brand)",
                          fontWeight: 600,
                          userSelect: "none",
                        }}
                      >
                        Compare State Snapshots
                      </summary>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                          gap: "1rem",
                          marginTop: "0.75rem",
                          fontFamily: "monospace",
                          fontSize: "0.75rem",
                        }}
                      >
                        {log.beforeSnapshot && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <span style={{ color: "var(--text-muted)" }}>Before Event:</span>
                            <pre
                              style={{
                                background: "rgba(0,0,0,0.25)",
                                border: "1px solid var(--border-color)",
                                borderRadius: "4px",
                                padding: "0.75rem",
                                overflow: "auto",
                                maxHeight: "180px",
                                whiteSpace: "pre-wrap",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {log.beforeSnapshot.trim().startsWith("{") || log.beforeSnapshot.trim().startsWith("[") ? (
                                JSON.stringify(JSON.parse(log.beforeSnapshot), null, 2)
                              ) : (
                                log.beforeSnapshot
                              )}
                            </pre>
                          </div>
                        )}
                        {log.afterSnapshot && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <span style={{ color: "var(--text-muted)" }}>After Event:</span>
                            <pre
                              style={{
                                background: "rgba(0,0,0,0.25)",
                                border: "1px solid var(--border-color)",
                                borderRadius: "4px",
                                padding: "0.75rem",
                                overflow: "auto",
                                maxHeight: "180px",
                                whiteSpace: "pre-wrap",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {log.afterSnapshot.trim().startsWith("{") || log.afterSnapshot.trim().startsWith("[") ? (
                                JSON.stringify(JSON.parse(log.afterSnapshot), null, 2)
                              ) : (
                                log.afterSnapshot
                              )}
                            </pre>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
