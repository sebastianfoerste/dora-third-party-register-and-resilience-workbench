"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ExportItem {
  id: string;
  entityScope: string;
  exportFormat: string;
  generatedFiles: string; // JSON string array
  validationWarnings: string | null; // JSON string array
  createdAt: string | Date;
}

interface Props {
  initialExports: ExportItem[];
  legalEntities: Array<{ id: string; name: string; licenceType: string }>;
  entriesCount: number;
}

export default function ExportCenter({ initialExports, legalEntities, entriesCount }: Props) {
  const router = useRouter();
  const [exportsList, setExportsList] = useState<ExportItem[]>(initialExports);
  const [entityScope, setEntityScope] = useState("CONSOLIDATED");
  const [exportFormat, setExportFormat] = useState("CSV");
  const [compiling, setCompiling] = useState(false);
  const [expandedExportId, setExpandedExportId] = useState<string | null>(null);

  const handleCompileExport = async () => {
    setCompiling(true);
    try {
      const response = await fetch("/api/exports/roi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityScope,
          exportFormat,
        }),
      });

      const res = await response.json();
      if (res.success) {
        setExportsList((prev) => [res.export, ...prev]);
        setExpandedExportId(res.export.id);
        router.refresh();
      } else {
        alert(res.error || "Export compilation failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to execute export.");
    } finally {
      setCompiling(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Supervisory Export Center</h1>
        <p className="page-subtitle">Compile, validate, and download DORA Register of Information (RoI) packages.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.5fr", gap: "2.5rem" }}>
        
        {/* Left Column: Generate Export */}
        <div className="card" style={{ height: "fit-content" }}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>Generate DORA Supervisor Package</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
            The generated package maps exactly to the EBA/ESMA Level 2 implementing technical standards for registers of information.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            
            <div className="form-group">
              <label className="form-label">Entity Compilation Scope</label>
              <select
                className="form-control"
                value={entityScope}
                onChange={(e) => setEntityScope(e.target.value)}
              >
                <option value="CONSOLIDATED">Consolidated Group Register (All Entities)</option>
                {legalEntities.map((le) => (
                  <option key={le.id} value={le.id}>
                    {le.name} ({le.licenceType})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Export Format Structure</label>
              <select
                className="form-control"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
              >
                <option value="CSV">Comma Separated Values (.csv)</option>
                <option value="EXCEL">Microsoft Excel Standard (.xlsx)</option>
              </select>
            </div>

            <div
              style={{
                backgroundColor: "rgba(20, 184, 166, 0.03)",
                border: "1px solid rgba(20, 184, 166, 0.15)",
                borderRadius: "var(--radius-sm)",
                padding: "1rem",
                fontSize: "0.8rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--color-brand)" }}>✓ Compliance Pre-flight Checks Active</span>
              <span style={{ color: "var(--text-secondary)" }}>
                Export compiling scans <strong>{entriesCount}</strong> register items, verifying LEIs, exit plans, and contract clauses.
              </span>
            </div>

            <button className="btn btn-primary" onClick={handleCompileExport} disabled={compiling}>
              {compiling ? (
                <>
                  <div className="spinner" style={{ width: "1rem", height: "1rem" }} />
                  Compiling Register Package...
                </>
              ) : (
                "Compile & Export Package"
              )}
            </button>

            <div style={{ display: "flex", alignItems: "center", margin: "0.5rem 0", gap: "0.5rem" }}>
              <hr style={{ flex: 1, border: "0.5px solid var(--border-color)", opacity: 0.3 }} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>OR</span>
              <hr style={{ flex: 1, border: "0.5px solid var(--border-color)", opacity: 0.3 }} />
            </div>

            <a
              href="/api/exports/coversheet"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ width: "1.1rem", height: "1.1rem" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Print Supervisor Cover Sheet
            </a>

            <a
              href="/exports/roi"
              className="btn btn-secondary"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                textDecoration: "none",
                textAlign: "center",
                border: "1px solid var(--color-brand)",
                color: "var(--color-brand)",
                marginTop: "0.25rem"
              }}
            >
              <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ width: "1.1rem", height: "1.1rem" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
              </svg>
              View Board Compliance ROI
            </a>

            <a
              href="/exports/board-packs"
              className="btn btn-secondary"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ width: "1.1rem", height: "1.1rem" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m4 6V7m4 10v-4M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H7.5L5 5.5V19a2 2 0 002 2z" />
              </svg>
              Open Board Pack Command Center
            </a>
          </div>
        </div>

        {/* Right Column: Export History */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="card">
            <h2 style={{ fontSize: "1.25rem", marginBottom: "1.25rem" }}>Export Archive & Audit Trails</h2>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {exportsList.map((exp) => {
                let files: string[] = [];
                try {
                  files = JSON.parse(exp.generatedFiles);
                } catch (_) {
                  files = [exp.generatedFiles];
                }

                let warnings: string[] = [];
                try {
                  if (exp.validationWarnings) {
                    warnings = JSON.parse(exp.validationWarnings);
                  }
                } catch (_) {}

                const isExpanded = expandedExportId === exp.id;

                return (
                  <div
                    key={exp.id}
                    className="card"
                    style={{
                      padding: "1.25rem",
                      backgroundColor: "rgba(0,0,0,0.15)",
                      border: "1px solid var(--border-color)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>
                          {exp.entityScope}
                        </h3>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                          Generated on {new Date(exp.createdAt).toLocaleString()} &middot; Format: {exp.exportFormat}
                        </div>
                      </div>

                      {warnings.length > 0 ? (
                        <span className="badge warning" style={{ fontWeight: 700 }}>
                          {warnings.length} Compliance Warnings
                        </span>
                      ) : (
                        <span className="badge success">0 Warnings (Ready)</span>
                      )}
                    </div>

                    {/* Download link */}
                    <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "0.25rem" }}>
                      {files.map((file, idx) => (
                        <a
                          key={idx}
                          href={file}
                          download
                          className="btn btn-primary"
                          style={{
                            padding: "0.35rem 0.75rem",
                            fontSize: "0.8rem",
                            backgroundColor: "var(--color-info)",
                            color: "#fff",
                          }}
                        >
                          <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ width: "1rem", height: "1rem" }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download {exp.exportFormat} Register
                        </a>
                      ))}

                      <button
                        className="btn btn-secondary"
                        onClick={() => setExpandedExportId(isExpanded ? null : exp.id)}
                        style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                      >
                        {isExpanded ? "Hide Reports" : "View Compliance Report"}
                      </button>
                    </div>

                    {/* Validation warning logs checklist */}
                    {isExpanded && (
                      <div
                        style={{
                          marginTop: "0.75rem",
                          borderTop: "1px solid rgba(255,255,255,0.06)",
                          paddingTop: "0.75rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--text-primary)" }}>
                          Pre-flight Compliance Audit Report:
                        </div>
                        {warnings.length > 0 ? (
                          <div
                            style={{
                              maxHeight: "180px",
                              overflowY: "auto",
                              paddingRight: "0.5rem",
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.35rem",
                            }}
                          >
                            {warnings.map((warn, index) => (
                              <div
                                key={index}
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--color-warning)",
                                  backgroundColor: "var(--color-warning-glow)",
                                  padding: "0.4rem 0.6rem",
                                  borderRadius: "2px",
                                  borderLeft: "2px solid var(--color-warning)",
                                }}
                              >
                                ⚠️ {warn}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: "0.75rem", color: "var(--color-brand)" }}>
                            ✓ Clean Export! Zero warnings, gaps, or structural errors were found during compilation.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {exportsList.length === 0 && (
                <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  No export packages generated yet. Click &ldquo;Compile & Export&rdquo; on the left to create your first submission package.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
