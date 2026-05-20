"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ServiceItem {
  id: string;
  serviceDescription: string;
  supportedFunction: string;
  location: string;
  subcontractingStatus: string;
  subcontractorDetails: string | null;
  substitutability: string;
  exitPlanStatus: string;
  criticalityAssessments: Array<{
    id: string;
    result: string;
    confidence: number;
    evidence: string;
    status: string;
    reviewer: string | null;
    scoringInputs: string;
  }>;
}

interface VendorDetail {
  id: string;
  legalName: string;
  groupName: string | null;
  country: string;
  lei: string | null;
  serviceCategories: string | null;
  concentrationTags: string | null;
  services: ServiceItem[];
}

interface Props {
  vendor: VendorDetail;
}

export default function VendorProfile({ vendor }: Props) {
  const router = useRouter();
  const [services, setServices] = useState<ServiceItem[]>(vendor.services);
  const [reviewingAssessmentId, setReviewingAssessmentId] = useState<string | null>(null);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewDecision, setReviewDecision] = useState("APPROVED");
  const [reviewResult, setReviewResult] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const startReview = (assessment: any) => {
    setReviewingAssessmentId(assessment.id);
    setReviewResult(assessment.result);
    setReviewerName("");
    setReviewDecision("APPROVED");
  };

  const handleSaveReview = async (assessmentId: string, serviceId: string) => {
    if (!reviewerName) {
      alert("Please enter the reviewer name/role.");
      return;
    }
    setSubmitting(true);
    try {
      // In this workbench, we can update the assessment status via a API route
      // Let's call /api/services/[id]/classify but with status changes,
      // or implement a specific review PATCH endpoint! Let's do a simple POST/PATCH.
      const response = await fetch(`/api/services/${serviceId}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supportedFunction: services.find((s) => s.id === serviceId)?.supportedFunction,
          substitutability: services.find((s) => s.id === serviceId)?.substitutability,
          exitPlanStatus: services.find((s) => s.id === serviceId)?.exitPlanStatus,
          dataSensitivity: "Customer PII",
          dependencySubcontractors: "NO",
        }),
      });

      const res = await response.json();
      if (res.success) {
        // Now let's update that assessment's status and reviewer in the DB
        // Let's create a general endpoint or run a custom patch. Let's make a quick patch call.
        const reviewRes = await fetch(`/api/findings/criticality-review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assessmentId,
            status: reviewDecision === "APPROVED" ? "APPROVED" : "OVERRIDDEN",
            reviewer: reviewerName,
            result: reviewResult,
          }),
        });
        const reviewData = await reviewRes.json();
        
        if (reviewData.success) {
          router.refresh();
          window.location.reload();
        }
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit criticality approval.");
    } finally {
      setSubmitting(false);
      setReviewingAssessmentId(null);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
        <Link href="/register" style={{ color: "var(--color-brand)", textDecoration: "none" }}>Register Cockpit</Link>
        <span>/</span>
        <span>Vendors</span>
        <span>/</span>
        <span>{vendor.legalName}</span>
      </div>

      <div className="page-header" style={{ marginBottom: "2rem" }}>
        <h1 className="page-title">{vendor.legalName}</h1>
        <p className="page-subtitle">Group: {vendor.groupName || "N/A"} &middot; Country: {vendor.country}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "2.5rem" }}>
        
        {/* Left Column: Vendor Profile details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="card">
            <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Vendor Specifications</h2>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", fontSize: "0.85rem" }}>
              <div>
                <span style={{ color: "var(--text-muted)", display: "block" }}>Legal Entity Identifier (LEI)</span>
                <strong style={{ color: vendor.lei ? "var(--text-primary)" : "var(--color-error)" }}>
                  {vendor.lei || "⚠️ Missing LEI (Mandatory under DORA Article 30)"}
                </strong>
              </div>

              <div>
                <span style={{ color: "var(--text-muted)", display: "block" }}>Primary Country Mapped</span>
                <strong>{vendor.country === "DE" ? "Germany (Wedge DE)" : vendor.country}</strong>
              </div>

              <div>
                <span style={{ color: "var(--text-muted)", display: "block" }}>Service Categories</span>
                <strong>{vendor.serviceCategories || "General Software"}</strong>
              </div>

              <div>
                <span style={{ color: "var(--text-muted)", display: "block" }}>Risk Concentration Tags</span>
                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                  {vendor.concentrationTags?.split(",").map((tag) => (
                    <span key={tag} className="badge non-critical" style={{ fontSize: "0.7rem" }}>
                      {tag.trim()}
                    </span>
                  )) || <span style={{ color: "var(--text-muted)" }}>None</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: ICT Services & Criticality approvals */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="card">
            <h2 style={{ fontSize: "1.2rem", marginBottom: "1.25rem" }}>Provided ICT Services ({services.length})</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {services.map((service) => {
                const assessment = service.criticalityAssessments[0]; // Fetch latest
                const isPending = assessment?.status === "PENDING";
                const isReviewing = reviewingAssessmentId === assessment?.id;

                return (
                  <div
                    key={service.id}
                    className="card"
                    style={{
                      backgroundColor: "rgba(0,0,0,0.15)",
                      border: "1px solid var(--border-color)",
                      padding: "1.25rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                      <div>
                        <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-primary)" }}>
                          {service.supportedFunction}
                        </h3>
                        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                          Location: {service.location} | Subcontracting: {service.subcontractingStatus}
                        </p>
                      </div>

                      {assessment && (
                        <span className={`badge ${
                          assessment.result === "CRITICAL"
                            ? "critical"
                            : assessment.result === "IMPORTANT"
                            ? "important"
                            : "non-critical"
                        }`}>
                          {assessment.result}
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                      {service.serviceDescription}
                    </p>

                    {/* DORA settings checklist */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem", backgroundColor: "rgba(0,0,0,0.1)", padding: "0.6rem 0.85rem", borderRadius: "4px" }}>
                      <span><strong>Substitutability:</strong> {service.substitutability}</span>
                      <span><strong>Exit Plan Status:</strong> {service.exitPlanStatus}</span>
                    </div>

                    {/* Criticality details banner */}
                    {assessment && (
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "0.75rem", fontSize: "0.8rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                          <span style={{ fontWeight: 600 }}>DORA Criticality Classification Reasoning:</span>
                          <span style={{ color: "var(--text-muted)" }}>Confidence: {Math.round(assessment.confidence * 100)}%</span>
                        </div>
                        <p style={{ color: "var(--text-secondary)", fontStyle: "italic", marginBottom: "0.75rem" }}>
                          &ldquo;{assessment.evidence}&rdquo;
                        </p>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            Review Status:{" "}
                            <strong style={{ color: isPending ? "var(--color-warning)" : "var(--color-brand)" }}>
                              {assessment.status}
                            </strong>
                            {assessment.reviewer && ` by ${assessment.reviewer}`}
                          </span>

                          {isPending && !isReviewing && (
                            <button
                              className="btn btn-secondary"
                              onClick={() => startReview(assessment)}
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                            >
                              Approve / Classify
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Criticality human approval form */}
                    {isReviewing && (
                      <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: "0.75rem" }}>Approved Classification</label>
                            <select
                              className="form-control"
                              value={reviewResult}
                              onChange={(e) => setReviewResult(e.target.value)}
                              style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem" }}
                            >
                              <option value="CRITICAL">CRITICAL (DORA Art 30 Enhanced Rules)</option>
                              <option value="IMPORTANT">IMPORTANT</option>
                              <option value="NON_CRITICAL">NON_CRITICAL</option>
                            </select>
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: "0.75rem" }}>Review Decision</label>
                            <select
                              className="form-control"
                              value={reviewDecision}
                              onChange={(e) => setReviewDecision(e.target.value)}
                              style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem" }}
                            >
                              <option value="APPROVED">APPROVED (Confirm AI Suggestion)</option>
                              <option value="OVERRIDDEN">OVERRIDDEN (Manual Overwrite)</option>
                            </select>
                          </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: "0.75rem" }}>Reviewer Name / Title (Required)</label>
                          <input
                            type="text"
                            placeholder="e.g. Risk Lead or Chief Compliance Officer"
                            className="form-control"
                            value={reviewerName}
                            onChange={(e) => setReviewerName(e.target.value)}
                            style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem" }}
                            required
                          />
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => setReviewingAssessmentId(null)}
                            disabled={submitting}
                            style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleSaveReview(assessment.id, service.id)}
                            disabled={submitting}
                            style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                          >
                            {submitting ? "Saving..." : "Approve Criticality"}
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

      </div>
    </div>
  );
}
