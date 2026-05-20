"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface FindingItem {
  id: string;
  requirementId: string;
  status: "PRESENT" | "MISSING" | "PARTIAL" | "UNCLEAR";
  extractedEvidence: string | null;
  confidence: number;
  reviewerDecision: string | null;
  reviewerComments: string | null;
  requirement: {
    regulatoryBasis: string;
    requirementName: string;
    severity: string;
    description: string;
  };
}

interface ContractDetail {
  id: string;
  sourceFile: string;
  effectiveDate: string | null;
  terminationDate: string | null;
  governingLaw: string;
  extractedText: string;
  vendor: { legalName: string; lei: string | null };
  legalEntity: { name: string };
  clauseFindings: FindingItem[];
}

interface Props {
  contract: ContractDetail;
}

export default function ContractReview({ contract }: Props) {
  const router = useRouter();
  const [findings, setFindings] = useState<FindingItem[]>(contract.clauseFindings);
  const [editingFindingId, setEditingFindingId] = useState<string | null>(null);

  // Override Form States
  const [overrideStatus, setOverrideStatus] = useState<any>("PRESENT");
  const [overrideDecision, setOverrideDecision] = useState<string>("OVERRIDDEN");
  const [overrideComments, setOverrideComments] = useState<string>("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const startEdit = (finding: FindingItem) => {
    setEditingFindingId(finding.id);
    setOverrideStatus(finding.status);
    setOverrideDecision(finding.reviewerDecision || "OVERRIDDEN");
    setOverrideComments(finding.reviewerComments || "");
  };

  const handleSaveReview = async (findingId: string) => {
    setUpdatingId(findingId);
    try {
      const response = await fetch(`/api/findings/${findingId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: overrideStatus,
          reviewerDecision: overrideDecision,
          reviewerComments: overrideComments,
        }),
      });

      const res = await response.json();
      if (res.success) {
        // Update local state
        setFindings((prev) =>
          prev.map((f) => (f.id === findingId ? { ...f, ...res.finding } : f))
        );
        setEditingFindingId(null);
        router.refresh();
      } else {
        alert(res.error || "Failed to save human review.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save human review.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Score calculations
  const presentCount = findings.filter((f) => f.status === "PRESENT").length;
  const missingCount = findings.filter((f) => f.status === "MISSING").length;
  const compliancePct = findings.length > 0 ? Math.round((presentCount / findings.length) * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
            <Link href="/contracts" style={{ color: "var(--color-brand)", textDecoration: "none" }}>Contracts</Link>
            <span>/</span>
            <span>{contract.sourceFile}</span>
          </div>
          <h1 className="page-title">{contract.sourceFile}</h1>
          <p className="page-subtitle">
            Vendor: <strong>{contract.vendor.legalName}</strong> | Entity: <strong>{contract.legalEntity.name}</strong>
          </p>
        </div>

        {/* Contract Compliance Gauge */}
        <div className="card" style={{ padding: "0.85rem 1.5rem", display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <div>
            <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
              Contract Compliance Score
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-display)", color: compliancePct > 80 ? "var(--color-brand)" : compliancePct > 50 ? "var(--color-warning)" : "var(--color-error)" }}>
              {compliancePct}%
            </div>
          </div>
          <div style={{ width: "80px", height: "8px", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{ width: `${compliancePct}%`, height: "100%", backgroundColor: compliancePct > 80 ? "var(--color-brand)" : compliancePct > 50 ? "var(--color-warning)" : "var(--color-error)" }} />
          </div>
        </div>
      </div>

      <div className="split-pane">
        
        {/* Left Pane: Full Contract Text */}
        <div className="pane-left">
          <div style={{ paddingBottom: "1rem", borderBottom: "1px solid var(--border-color)", marginBottom: "1rem", color: "var(--text-primary)", fontWeight: 600, fontSize: "0.85rem" }}>
            📄 Extracted Document Text (OCR Preview)
          </div>
          {contract.extractedText || "No text content has been processed for this contract."}
        </div>

        {/* Right Pane: Requirements Checklist */}
        <div className="pane-right">
          <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)", marginBottom: "0.5rem" }}>
            DORA Article 30(2) Clause Findings ({findings.length})
          </div>

          {findings.map((f) => {
            const isEditing = editingFindingId === f.id;
            const isUpdating = updatingId === f.id;

            return (
              <div
                key={f.id}
                className="card"
                style={{
                  padding: "1rem 1.25rem",
                  backgroundColor: "rgba(30, 38, 56, 0.3)",
                  borderLeft: `4px solid ${
                    f.status === "PRESENT"
                      ? "var(--color-brand)"
                      : f.status === "PARTIAL"
                      ? "var(--color-warning)"
                      : "var(--color-error)"
                  }`,
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-brand)", textTransform: "uppercase" }}>
                      {f.requirement.regulatoryBasis}
                    </span>
                    <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)", marginTop: "0.1rem" }}>
                      {f.requirement.requirementName}
                    </h4>
                  </div>
                  <span className={`badge ${
                    f.status === "PRESENT"
                      ? "success"
                      : f.status === "PARTIAL"
                      ? "warning"
                      : "danger"
                  }`}>
                    {f.status}
                  </span>
                </div>

                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                  {f.requirement.description}
                </p>

                {/* Evidence Box */}
                {f.extractedEvidence ? (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", backgroundColor: "rgba(0,0,0,0.2)", padding: "0.6rem 0.85rem", borderLeft: "2px solid rgba(255,255,255,0.15)", borderRadius: "2px", marginBottom: "0.75rem", fontStyle: "italic" }}>
                    &ldquo;{f.extractedEvidence}&rdquo;
                  </div>
                ) : (
                  <div style={{ fontSize: "0.8rem", color: "var(--color-error)", backgroundColor: "rgba(239, 68, 68, 0.03)", padding: "0.5rem 0.75rem", borderRadius: "2px", marginBottom: "0.75rem" }}>
                    ⚠️ No matching clause language detected by AI scanner.
                  </div>
                )}

                {/* Review Decsion Meta */}
                {f.reviewerDecision && (
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem", display: "flex", gap: "0.35rem", alignItems: "center" }}>
                    <span className="dot success" style={{ width: "6px", height: "6px" }} />
                    <span>Reviewed: <strong>{f.reviewerDecision}</strong></span>
                    {f.reviewerComments && <span>&middot; &ldquo;{f.reviewerComments}&rdquo;</span>}
                  </div>
                )}

                {/* Action Buttons */}
                {!isEditing ? (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => startEdit(f)}
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", borderRadius: "4px" }}
                    >
                      Audit / Override
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.75rem" }}>Manual Compliance Status</label>
                        <select
                          className="form-control"
                          value={overrideStatus}
                          onChange={(e) => setOverrideStatus(e.target.value as any)}
                          style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem" }}
                        >
                          <option value="PRESENT">PRESENT (Compliant)</option>
                          <option value="MISSING">MISSING (Gap)</option>
                          <option value="PARTIAL">PARTIAL</option>
                          <option value="UNCLEAR">UNCLEAR</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.75rem" }}>Audit Decision</label>
                        <select
                          className="form-control"
                          value={overrideDecision}
                          onChange={(e) => setOverrideDecision(e.target.value)}
                          style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem" }}
                        >
                          <option value="APPROVED">APPROVED (Confirm AI)</option>
                          <option value="OVERRIDDEN">OVERRIDDEN (Manual Adjust)</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Compliance Comments / Context</label>
                      <input
                        type="text"
                        placeholder="e.g. Verified data hosting audit right in Annex A"
                        className="form-control"
                        value={overrideComments}
                        onChange={(e) => setOverrideComments(e.target.value)}
                        style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem" }}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setEditingFindingId(null)}
                        disabled={isUpdating}
                        style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleSaveReview(f.id)}
                        disabled={isUpdating}
                        style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                      >
                        {isUpdating ? "Saving..." : "Save Findings"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
