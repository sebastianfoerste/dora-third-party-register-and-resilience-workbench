"use client";

import { useEffect, useState } from "react";

interface ClauseRequirement {
  regulatoryBasis: string;
  requirementName: string;
  description: string;
}

interface ClauseFinding {
  id: string;
  status: string;
  requirement: ClauseRequirement;
}

interface Contract {
  id: string;
  sourceFile: string;
  governingLaw: string;
  clauseFindings: ClauseFinding[];
}

interface Service {
  id: string;
  supportedFunction: string;
  criticalityAssessments: Array<{ result: string }>;
}

interface Vendor {
  id: string;
  legalName: string;
  country: string;
  contracts: Contract[];
  services: Service[];
}

export default function OutreachPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [outreachText, setOutreachText] = useState("");
  const [copied, setCopied] = useState(false);
  const [sentStatus, setSentStatus] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetch("/api/outreach");
      const data = await res.json();
      if (data.success) {
        setVendors(data.vendors);
      }
    } catch (err) {
      console.error("Failed to load outreach vendors:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getMissingClauses = (vendor: Vendor) => {
    const missing: { basis: string; name: string }[] = [];
    vendor.contracts.forEach((contract) => {
      contract.clauseFindings.forEach((finding) => {
        if (finding.status === "MISSING" || finding.status === "PARTIAL") {
          missing.push({
            basis: finding.requirement.regulatoryBasis,
            name: finding.requirement.requirementName,
          });
        }
      });
    });
    return missing;
  };

  const handleSelectVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setCopied(false);
    setSentStatus(false);

    const missing = getMissingClauses(vendor);
    if (missing.length === 0) {
      setOutreachText(`Subject: DORA Compliance Review - ${vendor.legalName}

Dear Vendor Management Team,

We have completed our regulatory compliance assessment of our existing contractual arrangements under the Digital Operational Resilience Act (DORA) (EU) 2022/2554.

We are pleased to inform you that our audit indicates that all mandatory contractual provisions required under DORA Article 30 are present and in full alignment. No contract amendments are required at this time.

Thank you for your ongoing partnership.

Sincerely,
Compliance Team`);
      return;
    }

    const clauseBullets = missing
      .map((m) => `- ${m.basis}: ${m.name}`)
      .join("\n");

    const draft = `Subject: URGENT: DORA Article 30 Contract Amendment Request - ${vendor.legalName}

Dear Partner,

We are contacting you on behalf of the Compliance & Risk Department regarding our active service agreement(s).

As you are aware, the Digital Operational Resilience Act (DORA) (Regulation (EU) 2022/2554) became fully applicable on 17 January 2025. DORA imposes mandatory contractual obligations on financial entities and their ICT third-party service providers.

We have conducted a compliance gap analysis of our existing contract (${vendor.contracts[0]?.sourceFile || "Service Agreement"}) and identified several mandatory regulatory provisions that must be explicitly added or amended:

${clauseBullets}

To ensure uninterrupted service delivery and mutual compliance with BaFin / ESMA guidelines, we require an amendment or a DORA Addendum covering these items. 

We have prepared a standard DORA Amendment Template. Please have your legal or compliance team review this request and contact us within 10 business days to coordinate execution of the amendment.

Thank you for your prompt attention to this matter.

Sincerely,
Chief Compliance Officer
Solaris SE / Bitpanda Custody`;

    setOutreachText(draft);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(outreachText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!selectedVendor) return;
    const blob = new Blob([outreachText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dora_outreach_${selectedVendor.legalName.toLowerCase().replace(/\s+/g, "_")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleMarkAsSent = async () => {
    if (!selectedVendor) return;
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: selectedVendor.id,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSentStatus(true);
      } else {
        alert(data.error || "Failed to process outreach.");
      }
    } catch (e) {
      console.error("Failed to mark outreach as sent:", e);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "2rem" }}>
        <h1 className="page-title">Vendor Outreach Console</h1>
        <p className="page-subtitle">
          Remediate DORA Article 30 contractual compliance gaps. Select an ICT vendor with missing clauses to generate standard legal amendment requests.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2.5fr", gap: "1.5rem", alignItems: "stretch" }}>
        
        {/* Left Side: Vendor selection list */}
        <div className="card" style={{ padding: "1rem" }}>
          <h2 style={{ fontSize: "0.9rem", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 1rem 0" }}>
            ICT Third-Party Providers
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {vendors.map((vendor) => {
              const missing = getMissingClauses(vendor);
              const isSelected = selectedVendor?.id === vendor.id;

              return (
                <div
                  key={vendor.id}
                  onClick={() => handleSelectVendor(vendor)}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "6px",
                    cursor: "pointer",
                    backgroundColor: isSelected ? "rgba(20, 184, 166, 0.08)" : "rgba(22, 28, 41, 0.2)",
                    border: isSelected ? "1px solid var(--color-brand)" : "1px solid var(--border-color)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <strong style={{ display: "block", fontSize: "0.85rem", color: isSelected ? "var(--color-brand)" : "var(--text-primary)" }}>
                    {vendor.legalName}
                  </strong>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem" }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{vendor.country}</span>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        padding: "0.1rem 0.4rem",
                        borderRadius: "10px",
                        backgroundColor: missing.length > 0 ? "rgba(239, 68, 68, 0.1)" : "rgba(20, 184, 166, 0.1)",
                        color: missing.length > 0 ? "var(--color-error)" : "var(--color-brand)",
                      }}
                    >
                      {missing.length === 0 ? "COMPLIANT" : `${missing.length} GAPS`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Outreach letter compiler */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          {selectedVendor ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "1rem" }}>
              <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>
                    Outreach Draft: {selectedVendor.legalName}
                  </h2>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Based on {selectedVendor.contracts.length} contract(s) uploaded
                  </span>
                </div>
                
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-secondary" style={{ fontSize: "0.75rem", padding: "0.4rem 0.8rem" }} onClick={handleCopy}>
                    {copied ? "Copied!" : "Copy Clipboard"}
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: "0.75rem", padding: "0.4rem 0.8rem" }} onClick={handleDownload}>
                    Download .txt
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: "0.75rem", padding: "0.4rem 0.8rem" }}
                    onClick={handleMarkAsSent}
                    disabled={sentStatus}
                  >
                    {sentStatus ? "✓ Logged as Sent" : "Mark as Sent"}
                  </button>
                </div>
              </div>

              {sentStatus && (
                <div style={{ padding: "0.6rem 0.8rem", borderRadius: "4px", backgroundColor: "rgba(20, 184, 166, 0.08)", border: "1px solid rgba(20, 184, 166, 0.2)", color: "var(--color-brand)", fontSize: "0.8rem" }}>
                  ✓ Communication logged to the audit log. Contract remediation status has been updated.
                </div>
              )}

              {/* Display list of identified gaps */}
              <div>
                <strong style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>
                  Identified Contractual Gaps (DORA Article 30):
                </strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {getMissingClauses(selectedVendor).map((m, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "4px",
                        backgroundColor: "rgba(239, 68, 68, 0.05)",
                        border: "1px solid rgba(239, 68, 68, 0.15)",
                        color: "var(--color-error)",
                      }}
                    >
                      {m.basis} &mdash; {m.name}
                    </span>
                  ))}
                  {getMissingClauses(selectedVendor).length === 0 && (
                    <span style={{ fontSize: "0.7rem", color: "var(--color-brand)", fontStyle: "italic" }}>
                      No missing clauses found. Vendor agreement is fully compliant.
                    </span>
                  )}
                </div>
              </div>

              {/* Text draft editor */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <label className="form-label" style={{ fontSize: "0.75rem" }}>Edit Amendment Request</label>
                <textarea
                  className="form-control"
                  style={{
                    flex: 1,
                    minHeight: "350px",
                    fontFamily: "Courier, monospace",
                    fontSize: "0.8rem",
                    lineHeight: "1.5",
                    backgroundColor: "rgba(10, 12, 18, 0.4)",
                    color: "var(--text-primary)",
                  }}
                  value={outreachText}
                  onChange={(e) => setOutreachText(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", padding: "4rem 2rem", textAlign: "center", color: "var(--text-muted)" }}>
              <svg style={{ width: "48px", height: "48px", stroke: "currentColor", fill: "none", marginBottom: "1rem", opacity: 0.3 }} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h3 style={{ fontSize: "1rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Outreach Draft Workspace</h3>
              <p style={{ fontSize: "0.8rem", maxWidth: "350px" }}>
                Select a vendor from the provider list to analyze active agreement gaps and draft a standard DORA amendment outreach email.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
