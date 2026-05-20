"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface RegisterEntryItem {
  id: string;
  legalEntity: { id: string; name: string; lei: string | null };
  vendor: { id: string; legalName: string; lei: string | null };
  service: { id: string; serviceDescription: string; supportedFunction: string; location: string };
  contract: { id: string; sourceFile: string; clauseFindings: any[] } | null;
  criticality: string;
  validationStatus: string;
  validationErrors: string | null;
}

interface Props {
  initialEntries: RegisterEntryItem[];
  legalEntities: any[];
  vendors: any[];
}

export default function RegisterCockpit({ initialEntries, legalEntities, vendors }: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState<RegisterEntryItem[]>(initialEntries);
  const [filterCriticality, setFilterCriticality] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  // Import Modal States
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvFileContent, setCsvFileContent] = useState<string>("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Target DORA register fields
  const TARGET_FIELDS = [
    { key: "legalEntityName", label: "Legal Entity Name (Required)" },
    { key: "vendorName", label: "Vendor Name (Required)" },
    { key: "serviceDescription", label: "Service Description (Required)" },
    { key: "supportedFunction", label: "Supported Function" },
    { key: "location", label: "Data Storage Location" },
    { key: "subcontractingStatus", label: "Subcontracting Status (YES/NO)" },
    { key: "substitutability", label: "Substitutability (EASY/MEDIUM/DIFFICULT)" },
    { key: "exitPlanStatus", label: "Exit Plan (APPROVED/DRAFT/NONE)" },
  ];

  // Simple client CSV header reader
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvFileContent(text);
      
      // Read first line for headers
      const lines = text.split(/\r?\n/);
      if (lines.length > 0) {
        // Basic split (commas inside quotes ignored for simple preview)
        const firstLine = lines[0];
        const headers = firstLine.split(",").map((h) => h.replace(/^"|"$/g, "").trim());
        setCsvHeaders(headers);

        // Auto-match headers to target fields
        const initialMapping: Record<string, string> = {};
        TARGET_FIELDS.forEach((tf) => {
          const match = headers.find((h) => {
            const hl = h.toLowerCase();
            const tl = tf.key.toLowerCase();
            return (
              hl === tl ||
              hl.includes(tl) ||
              (tf.key === "legalEntityName" && (hl.includes("entity") || hl.includes("firm") || hl.includes("company"))) ||
              (tf.key === "vendorName" && (hl.includes("vendor") || hl.includes("provider") || hl.includes("supplier"))) ||
              (tf.key === "serviceDescription" && (hl.includes("service") || hl.includes("desc"))) ||
              (tf.key === "supportedFunction" && (hl.includes("function") || hl.includes("core"))) ||
              (tf.key === "location" && (hl.includes("location") || hl.includes("country") || hl.includes("region")))
            );
          });
          if (match) {
            initialMapping[tf.key] = match;
          }
        });
        setColumnMapping(initialMapping);
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (!csvFileContent) return;
    setImporting(true);
    setImportResult(null);

    try {
      const response = await fetch("/api/imports/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvContent: csvFileContent,
          mapping: columnMapping,
        }),
      });

      const resData = await response.json();
      setImportResult(resData);
      
      if (resData.success) {
        router.refresh();
        // Wait briefly, then close modal
        setTimeout(() => {
          setShowImportModal(false);
          setCsvFileContent("");
          setCsvHeaders([]);
          setColumnMapping({});
          setImportResult(null);
          // Reload page
          window.location.reload();
        }, 2000);
      }
    } catch (err: any) {
      console.error(err);
      setImportResult({ success: false, error: "Import network transaction failed." });
    } finally {
      setImporting(false);
    }
  };

  // Filter and search logic
  const filteredEntries = entries.filter((e) => {
    const matchesSearch =
      e.vendor.legalName.toLowerCase().includes(search.toLowerCase()) ||
      e.service.supportedFunction.toLowerCase().includes(search.toLowerCase()) ||
      e.legalEntity.name.toLowerCase().includes(search.toLowerCase());

    const matchesCriticality =
      filterCriticality === "ALL" || e.criticality === filterCriticality;

    const matchesStatus =
      filterStatus === "ALL" || e.validationStatus === filterStatus;

    return matchesSearch && matchesCriticality && matchesStatus;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 className="page-title">Register of Information</h1>
          <p className="page-subtitle">Unified DORA ICT Third-Party Services Register</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowImportModal(true)}>
          <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ width: "1.1rem", height: "1.1rem" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import Register (CSV)
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: "1.25rem", marginBottom: "2rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: "240px" }}>
            <input
              type="text"
              placeholder="Search by vendor, service, or legal entity..."
              className="form-control"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
            />
          </div>

          <div style={{ display: "flex", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Criticality:</span>
              <select
                className="form-control"
                value={filterCriticality}
                onChange={(e) => setFilterCriticality(e.target.value)}
                style={{ width: "140px", padding: "0.4rem 0.6rem" }}
              >
                <option value="ALL">All Categories</option>
                <option value="CRITICAL">Critical</option>
                <option value="IMPORTANT">Important</option>
                <option value="NON_CRITICAL">Non-Critical</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Validation:</span>
              <select
                className="form-control"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ width: "140px", padding: "0.4rem 0.6rem" }}
              >
                <option value="ALL">All States</option>
                <option value="VALID">Valid</option>
                <option value="WARNING">Warning</option>
                <option value="INVALID">Invalid</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Dense Table Grid */}
      <div className="table-container">
        <table className="dense-table">
          <thead>
            <tr>
              <th>Legal Entity</th>
              <th>ICT Vendor</th>
              <th>Function / Service</th>
              <th>Criticality</th>
              <th>Mapped Contract</th>
              <th>Clause Gaps</th>
              <th>Validation Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map((e) => {
              let errorsList: string[] = [];
              if (e.validationErrors) {
                try {
                  errorsList = JSON.parse(e.validationErrors);
                } catch (_) {}
              }

              // Count missing findings
              const gapsCount = e.contract
                ? e.contract.clauseFindings.filter((f) => f.status === "MISSING").length
                : 9; // If no contract, all 9 clauses are missing

              return (
                <tr key={e.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{e.legalEntity.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>LEI: {e.legalEntity.lei || "Missing"}</div>
                  </td>
                  <td>
                    <Link
                      href={`/vendors/${e.vendor.id}`}
                      style={{ color: "var(--text-primary)", fontWeight: 600, textDecoration: "none" }}
                      className="hover-underline"
                    >
                      {e.vendor.legalName}
                    </Link>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>LEI: {e.vendor.lei || "Missing"}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{e.service.supportedFunction}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.1rem" }}>
                      {e.service.serviceDescription.length > 60
                        ? `${e.service.serviceDescription.substring(0, 60)}...`
                        : e.service.serviceDescription}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${e.criticality === "CRITICAL" ? "critical" : e.criticality === "IMPORTANT" ? "important" : "non-critical"}`}>
                      {e.criticality}
                    </span>
                  </td>
                  <td>
                    {e.contract ? (
                      <Link
                        href={`/contracts/${e.contract.id}`}
                        style={{ color: "var(--color-brand)", textDecoration: "none", fontSize: "0.85rem", fontWeight: 500 }}
                      >
                        {e.contract.sourceFile}
                      </Link>
                    ) : (
                      <span style={{ color: "var(--color-error)", fontSize: "0.85rem", fontWeight: 500 }}>
                        No Contract Mapped
                      </span>
                    )}
                  </td>
                  <td>
                    {gapsCount > 0 ? (
                      <span className={`badge ${gapsCount > 3 ? "danger" : "warning"}`} style={{ fontWeight: 700 }}>
                        {gapsCount} Clause Gap{gapsCount > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="badge success">Compliant (0 Gaps)</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <span className={`badge ${e.validationStatus === "VALID" ? "success" : e.validationStatus === "WARNING" ? "warning" : "danger"}`}>
                        {e.validationStatus}
                      </span>
                      {errorsList.length > 0 && (
                        <div style={{ fontSize: "0.7rem", color: "var(--color-error)", maxWidth: "200px" }}>
                          • {errorsList[0]} {errorsList.length > 1 && `(+${errorsList.length - 1} more)`}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredEntries.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                  No register entries match selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "680px" }}>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>Import DORA Register</h2>
            <p className="page-subtitle" style={{ marginBottom: "1.5rem" }}>
              Upload your Excel or CSV register of information. We'll map the columns and validate regulatory compliance.
            </p>

            {!csvFileContent ? (
              <div className="upload-zone">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                  id="csv-file-input"
                />
                <label htmlFor="csv-file-input" style={{ width: "100%", height: "100%", cursor: "pointer" }}>
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    style={{ width: "3rem", height: "3rem", color: "var(--text-muted)", marginBottom: "1rem" }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                  <p style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.25rem" }}>Select Register CSV File</p>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>UTF-8 formatted comma-separated values (.csv)</p>
                </label>
              </div>
            ) : (
              <div>
                <h3 style={{ fontSize: "1rem", marginBottom: "1rem", color: "var(--text-secondary)" }}>
                  Guided Column Mapping
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "300px", overflowY: "auto", paddingRight: "0.5rem" }}>
                  {TARGET_FIELDS.map((tf) => (
                    <div key={tf.key} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1rem", alignItems: "center" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-secondary)" }}>
                        {tf.label}
                      </span>
                      <select
                        className="form-control"
                        value={columnMapping[tf.key] || ""}
                        onChange={(e) => setColumnMapping({ ...columnMapping, [tf.key]: e.target.value })}
                        style={{ padding: "0.4rem 0.6rem" }}
                      >
                        <option value="">-- Do Not Import --</option>
                        {csvHeaders.map((headerName) => (
                          <option key={headerName} value={headerName}>
                            {headerName}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {importResult && (
                  <div
                    style={{
                      marginTop: "1.25rem",
                      padding: "1rem",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: importResult.success ? "var(--color-brand-glow)" : "var(--color-error-glow)",
                      border: `1px solid ${importResult.success ? "var(--color-brand)" : "var(--color-error)"}`,
                      fontSize: "0.85rem",
                    }}
                  >
                    {importResult.success ? (
                      <span style={{ color: "var(--color-brand)", fontWeight: 600 }}>
                        ✓ Successfully imported {importResult.importedCount} register rows! Validating completeness...
                      </span>
                    ) : (
                      <span style={{ color: "var(--color-error)", fontWeight: 600 }}>
                        ❌ Import Failed: {importResult.error || importResult.errors?.[0]}
                      </span>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "1.5rem" }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setCsvFileContent("");
                      setCsvHeaders([]);
                      setColumnMapping({});
                    }}
                    disabled={importing}
                  >
                    Reset File
                  </button>
                  <button className="btn btn-primary" onClick={handleImportSubmit} disabled={importing || !columnMapping.legalEntityName || !columnMapping.vendorName || !columnMapping.serviceDescription}>
                    {importing ? "Importing Data..." : "Run Import & Validate"}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowImportModal(false)}
              style={{
                position: "absolute",
                top: "1.25rem",
                right: "1.25rem",
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: "1.25rem",
              }}
              disabled={importing}
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
