"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ContractItem {
  id: string;
  sourceFile: string;
  effectiveDate: string | null;
  terminationDate: string | null;
  governingLaw: string;
  vendor: { legalName: string };
  legalEntity: { name: string };
  clauseFindings: any[];
}

interface Props {
  initialContracts: ContractItem[];
  vendors: any[];
  legalEntities: any[];
}

const SAMPLE_TEMPLATES = [
  {
    name: "Standard EU Cloud Hosting SLA (compliant)",
    law: "Germany (BaFin jurisdiction compliance)",
    text: `CLOUD STORAGE AND BACKUP SLA
This Cloud Storage Agreement is entered into on March 14, 2025, between Bitpanda Custody GmbH ("Customer"), Frankfurt, and Amazon Web Services EMEA SARL ("Provider"), Luxembourg.

1. Description: Provider provides virtual storage blocks with 99.95% monthly availability as outlined in Schedule C.
2. Data Center Location: All client transactions and custody databases are hosted in the Provider's Frankfurt (DE) Central-1 facility. Data is encrypted using AES-256 keys.
3. Access & Audit: The Customer and its competent financial supervisor (BaFin) are granted unrestricted physical and virtual access to the Provider's offices and server rooms on 24 hours notice to inspect logging controls and security configuration.
4. Incident Report: Provider is contractually obligated to report any operational anomaly or security incident to Customer within four (4) hours of detection.
5. Exit migration: If terminated, Provider must transfer all backup files to Customer's designated location within 30 days and assist transition without disruption.
6. Termination: Customer may terminate this agreement immediately upon notice of material regulatory breach or supervisor instruction.
7. Subcontracting: Sub-processing is prohibited without the express written prior approval of the Customer.
`,
  },
  {
    name: "SaaS API Subscription (non-compliant / US law)",
    law: "New York, USA",
    text: `SOFTWARE SUBSCRIPTION TERMS OF SERVICE
This API Agreement is between Solaris SE ("Customer"), Berlin, and Fireblocks Ltd ("Provider"), Israel.

1. Grant of License: Provider grants Customer access to its key management API sandbox. Uptime is targeted at 99%.
2. Limitations: Customer may not copy, reverse engineer, or decompile the API source code.
3. Governing Law: This license is governed by New York law, excluding conflict of laws.
4. Subcontractors: Provider reserves the right to delegate any operational task to sub-processors globally without prior notice.
5. Liability: Provider is not liable for data loss or outages under any circumstances.
`,
  },
  {
    name: "KYC Vendor Integration Contract (partial compliance)",
    law: "England and Wales",
    text: `IDENTITY VERIFICATION SERVICES AGREEMENT
Between Bitpanda Custody GmbH ("Customer") and Sum & Substance Ltd ("Provider"), London, UK.

1. Services: Identity verification check API for retail registration.
2. Governing Law: This agreement is governed by the laws of England and Wales.
3. Data Protection: GDPR compliance is maintained. Data centers are in London, UK.
4. SLA: Target response time for KYC check is under 15 seconds.
5. Auditing: Customer may request a security audit report once per year. Physical audits are not permitted.
6. Incidents: Provider will notify Customer of any data breach within 72 hours.
7. Sub-processors: Subcontracting is permitted if the sub-processors maintain adequate security credentials.
`,
  },
];

export default function ContractIngestion({ initialContracts, vendors, legalEntities }: Props) {
  const router = useRouter();
  const [contracts, setContracts] = useState<ContractItem[]>(initialContracts);
  
  // Form States
  const [vendorId, setVendorId] = useState("");
  const [legalEntityId, setLegalEntityId] = useState("");
  const [sourceFile, setSourceFile] = useState("");
  const [governingLaw, setGoverningLaw] = useState("");
  const [contractText, setContractText] = useState("");
  
  // Loading & UI States
  const [saving, setSaving] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);

  const applyTemplate = (index: number) => {
    const template = SAMPLE_TEMPLATES[index];
    setContractText(template.text);
    setGoverningLaw(template.law);
    
    // Auto-fill filename based on template name
    const cleanName = template.name.replace(/\s+/g, "_").replace(/[\(\)]/g, "");
    setSourceFile(`${cleanName}.docx`);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId || !legalEntityId || !sourceFile || !contractText) {
      alert("Please fill out all fields and write/apply a contract template.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          legalEntityId,
          sourceFile,
          contractText,
          governingLaw,
          effectiveDate: null,
          renewalDate: null,
          terminationDate: null,
        }),
      });

      const res = await response.json();
      if (res.success) {
        setSourceFile("");
        setGoverningLaw("");
        setContractText("");
        router.refresh();
        window.location.reload();
      } else {
        alert(res.error || "Failed to create contract.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit contract.");
    } finally {
      setSaving(false);
    }
  };

  const handleRunExtract = async (contractId: string) => {
    setExtractingId(contractId);
    try {
      const response = await fetch(`/api/contracts/${contractId}/extract`, {
        method: "POST",
      });
      const res = await response.json();
      if (res.success) {
        router.refresh();
        window.location.reload();
      } else {
        alert(res.error || "Analysis failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Analysis failed.");
    } finally {
      setExtractingId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Contract Ingestion & OCR</h1>
        <p className="page-subtitle">Ingest ICT service contracts and evaluate DORA Article 30(2) clause gaps.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.5fr", gap: "2.5rem" }}>
        
        {/* Left Column: Upload Form */}
        <div className="card" style={{ height: "fit-content" }}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "1.25rem" }}>Upload Mapped Contract</h2>
          <form onSubmit={handleUploadSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            
            <div className="form-group">
              <label className="form-label">Associated Vendor</label>
              <select
                className="form-control"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                required
              >
                <option value="">-- Select Vendor --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.legalName} ({v.country})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Regulated Legal Entity</label>
              <select
                className="form-control"
                value={legalEntityId}
                onChange={(e) => setLegalEntityId(e.target.value)}
                required
              >
                <option value="">-- Select Legal Entity --</option>
                {legalEntities.map((le) => (
                  <option key={le.id} value={le.id}>
                    {le.name} ({le.licenceType})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Contract Template Mappings</label>
              <select
                className="form-control"
                onChange={(e) => {
                  if (e.target.value !== "") applyTemplate(parseInt(e.target.value));
                }}
                defaultValue=""
                style={{ border: "1px solid var(--color-brand)" }}
              >
                <option value="">-- Select DORA Contract Template --</option>
                {SAMPLE_TEMPLATES.map((t, idx) => (
                  <option key={idx} value={idx}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Document Source Filename</label>
              <input
                type="text"
                placeholder="e.g. AWS_Contract_Frankfurt_2025.pdf"
                className="form-control"
                value={sourceFile}
                onChange={(e) => setSourceFile(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Governing Law Jurisdiction</label>
              <input
                type="text"
                placeholder="e.g. Germany"
                className="form-control"
                value={governingLaw}
                onChange={(e) => setGoverningLaw(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contract Clause Text Content</label>
              <textarea
                placeholder="Paste or edit the contract clauses here..."
                className="form-control"
                value={contractText}
                onChange={(e) => setContractText(e.target.value)}
                style={{ height: "180px", fontFamily: "monospace", fontSize: "0.8rem", resize: "vertical" }}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving Document..." : "Save Contract Metadata"}
            </button>
          </form>
        </div>

        {/* Right Column: Contracts Listing */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="card">
            <h2 style={{ fontSize: "1.25rem", marginBottom: "1.25rem" }}>Ingested Contracts Registry</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {contracts.map((c) => {
                const audited = c.clauseFindings.length > 0;
                const missingCount = c.clauseFindings.filter((f) => f.status === "MISSING").length;
                const isExtracting = extractingId === c.id;

                return (
                  <div
                    key={c.id}
                    className="card"
                    style={{
                      padding: "1.25rem",
                      backgroundColor: "rgba(0,0,0,0.15)",
                      borderLeft: `4px solid ${audited ? (missingCount > 0 ? "var(--color-warning)" : "var(--color-brand)") : "rgba(255,255,255,0.08)"}`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: "1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>
                          {c.sourceFile}
                        </h3>
                        <span className={`badge ${audited ? "success" : "non-critical"}`}>
                          {audited ? "Audited" : "Pending Analysis"}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.4rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                        <span><strong>Vendor:</strong> {c.vendor.legalName}</span>
                        <span><strong>Entity Mapped:</strong> {c.legalEntity.name}</span>
                        <span><strong>Governing Law:</strong> {c.governingLaw}</span>
                        <span>
                          <strong>Effective Date:</strong>{" "}
                          {c.effectiveDate ? new Date(c.effectiveDate).toLocaleDateString() : "Pending Extraction"}
                        </span>
                      </div>

                      {audited && (
                        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                          {missingCount > 0 ? (
                            <span className="badge danger" style={{ fontWeight: 700 }}>
                              {missingCount} Clause Gap{missingCount > 1 ? "s" : ""} Found
                            </span>
                          ) : (
                            <span className="badge success">Compliant (0 Gaps)</span>
                          )}
                          <Link href={`/contracts/${c.id}`} style={{ fontSize: "0.8rem", color: "var(--color-brand)", textDecoration: "none" }}>
                            Open Review Screen &rarr;
                          </Link>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleRunExtract(c.id)}
                        disabled={isExtracting}
                        style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
                      >
                        {isExtracting ? (
                          <>
                            <div className="spinner" style={{ width: "0.8rem", height: "0.8rem" }} />
                            Auditing...
                          </>
                        ) : audited ? (
                          "Rerun DORA Audit"
                        ) : (
                          "Run DORA Audit"
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}

              {contracts.length === 0 && (
                <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  No contracts uploaded yet. Use the upload panel on the left to add your first contract.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
