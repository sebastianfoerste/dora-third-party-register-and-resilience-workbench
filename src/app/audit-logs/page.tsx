import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const revalidate = 0; // Don't cache compliance log views

export default async function AuditLogsPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: "desc" },
  });

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "2rem" }}>
        <h1 className="page-title">Supervisory Audit Trail</h1>
        <p className="page-subtitle">
          Regulatory compliance log recording all CRUD actions, manual reviewer overrides, and AI metadata ingestion events under DORA Articles 30 & 31.
        </p>
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1.2rem", marginBottom: "1.25rem" }}>Logged Events ({logs.length})</h2>

        {logs.length === 0 ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "var(--text-muted)" }}>
            No actions have been logged yet. Actions like imports, reviews, and remediation resolutions will register here.
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
              } else if (log.action.includes("EXTRACT") || log.action.includes("IMPORT")) {
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
                              {JSON.stringify(JSON.parse(log.beforeSnapshot), null, 2)}
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
                              {JSON.stringify(JSON.parse(log.afterSnapshot), null, 2)}
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
