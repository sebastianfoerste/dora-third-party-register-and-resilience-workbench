"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Subcontractor {
  id: string;
  name: string;
  lei: string | null;
  country: string;
  serviceDescription: string;
  criticality: string;
  location: string;
}

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
    evidence: string | null;
    status: string;
    reviewer: string | null;
    scoringInputs: string;
  }>;
  subcontractors: Subcontractor[];
}

interface ThreatIntelItem {
  id: string;
  cveId: string;
  description: string;
  severity: string;
  status: string;
  detectedAt: string | Date;
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
  threatIntel: ThreatIntelItem[];
}

interface Props {
  vendor: VendorDetail;
}

export default function VendorProfile({ vendor }: Props) {
  const router = useRouter();
  const services = vendor.services;
  const [reviewingAssessmentId, setReviewingAssessmentId] = useState<string | null>(null);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewDecision, setReviewDecision] = useState("APPROVED");
  const [reviewResult, setReviewResult] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Subcontractor states
  const [addingSubToServiceId, setAddingSubToServiceId] = useState<string | null>(null);
  const [subName, setSubName] = useState("");
  const [subLei, setSubLei] = useState("");
  const [subCountry, setSubCountry] = useState("");
  const [subDesc, setSubDesc] = useState("");
  const [subCriticality, setSubCriticality] = useState("NON_CRITICAL");
  const [subLocation, setSubLocation] = useState("");
  const [savingSub, setSavingSub] = useState(false);

  const handleAddSubcontractor = async (serviceId: string) => {
    if (!subName || !subCountry || !subLocation) {
      alert("Please fill in Name, Country, and Location.");
      return;
    }
    setSavingSub(true);
    try {
      const res = await fetch(`/api/services/${serviceId}/subcontractors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: subName,
          lei: subLei || null,
          country: subCountry.toUpperCase(),
          serviceDescription: subDesc,
          criticality: subCriticality,
          location: subLocation,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAddingSubToServiceId(null);
        setSubName("");
        setSubLei("");
        setSubCountry("");
        setSubDesc("");
        setSubCriticality("NON_CRITICAL");
        setSubLocation("");
        router.refresh();
        window.location.reload();
      } else {
        alert("Failed to add subcontractor: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save subcontractor.");
    } finally {
      setSavingSub(false);
    }
  };

  const startReview = (assessment: ServiceItem["criticalityAssessments"][number]) => {
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

          {/* Active CVE Security Alerts */}
          <div className="card">
            <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Security Intel Feed</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {vendor.threatIntel && vendor.threatIntel.length > 0 ? (
                vendor.threatIntel.map((threat) => {
                  let sevColor = "var(--text-muted)";
                  if (threat.severity === "HIGH") sevColor = "var(--color-error)";
                  else if (threat.severity === "MEDIUM") sevColor = "var(--color-warning)";

                  const isUnpatched = threat.status === "UNPATCHED";

                  return (
                    <div
                      key={threat.id}
                      style={{
                        padding: "0.75rem",
                        borderRadius: "6px",
                        backgroundColor: "rgba(0,0,0,0.15)",
                        border: isUnpatched ? `1px solid ${sevColor}33` : "1px solid var(--border-color)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)" }}>{threat.cveId}</span>
                        <span
                          className={`badge ${threat.severity === "HIGH" ? "danger" : threat.severity === "MEDIUM" ? "warning" : "non-critical"}`}
                          style={{ fontSize: "0.65rem" }}
                        >
                          {threat.severity}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: "0 0 0.5rem 0", lineHeight: "1.3" }}>
                        {threat.description}
                      </p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.7rem" }}>
                        <span style={{ color: isUnpatched ? "var(--color-error)" : "var(--color-brand)", fontWeight: 600 }}>
                          {isUnpatched ? "⚠️ UNPATCHED" : "✓ PATCHED"}
                        </span>
                        <span style={{ color: "var(--text-muted)" }}>
                          {new Date(threat.detectedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                  ✓ No security threats or active CVE alerts recorded for this provider.
                </div>
              )}
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

                    {/* Visual dependency mapping chain */}
                    <div style={{ marginTop: "1.25rem", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1.25rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)" }}>
                          Visual Supply Chain Map (DORA Dependency Chain)
                        </span>
                        <button
                          className="btn btn-secondary"
                          onClick={() => setAddingSubToServiceId(addingSubToServiceId === service.id ? null : service.id)}
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", backgroundColor: "rgba(255,255,255,0.05)" }}
                        >
                          {addingSubToServiceId === service.id ? "Cancel" : "+ Add Subprocessor"}
                        </button>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", overflowX: "auto", padding: "0.5rem 0", marginBottom: "1rem" }}>
                        {/* Box 1: Regulated Entity */}
                        <div style={{
                          backgroundColor: "rgba(22, 28, 41, 0.45)",
                          border: "1px solid var(--border-color)",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          minWidth: "120px",
                          textAlign: "center"
                        }}>
                          <span style={{ display: "block", color: "var(--text-muted)", fontSize: "0.6rem", textTransform: "uppercase", fontWeight: 600 }}>Regulated Entity</span>
                          <strong style={{ color: "var(--text-primary)" }}>
                            {vendor.legalName.includes("Amazon") ? "Bitpanda Custody" : "Solaris SE"}
                          </strong>
                        </div>

                        {/* Arrow */}
                        <div style={{ color: "var(--color-brand)", fontWeight: 800 }}>➔</div>

                        {/* Box 2: Primary Service */}
                        <div style={{
                          backgroundColor: "rgba(0, 229, 255, 0.04)",
                          border: "1px solid var(--color-brand)",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          minWidth: "140px",
                          textAlign: "center"
                        }}>
                          <span style={{ display: "block", color: "var(--color-brand)", fontSize: "0.6rem", textTransform: "uppercase", fontWeight: 600 }}>Primary Service</span>
                          <strong style={{ color: "var(--text-primary)" }}>
                            {service.supportedFunction.length > 25 ? `${service.supportedFunction.slice(0, 22)}...` : service.supportedFunction}
                          </strong>
                        </div>

                        {/* Subcontractor boxes */}
                        {service.subcontractors && service.subcontractors.map((sub) => (
                          <div key={sub.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <div style={{ color: "var(--color-warning)", fontWeight: 800 }}>➔</div>
                            <div style={{
                              backgroundColor: "rgba(245, 158, 11, 0.04)",
                              border: "1px solid var(--color-warning)",
                              padding: "0.5rem 0.75rem",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              minWidth: "140px",
                              textAlign: "center"
                            }}>
                              <span style={{ display: "block", color: "var(--color-warning)", fontSize: "0.6rem", textTransform: "uppercase", fontWeight: 600 }}>Subprocessor ({sub.country})</span>
                              <strong style={{ color: "var(--text-primary)" }}>{sub.name}</strong>
                              {sub.criticality === "CRITICAL" && (
                                <span className="badge danger" style={{ display: "block", fontSize: "0.55rem", padding: "1px 2px", marginTop: "0.2rem" }}>
                                  CRITICAL SUB
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Subcontractor details list */}
                      {service.subcontractors && service.subcontractors.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.75rem", backgroundColor: "rgba(0,0,0,0.15)", padding: "0.75rem", borderRadius: "4px", marginBottom: "1rem", border: "1px solid var(--border-color)" }}>
                          <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>Subprocessor Registry Details:</span>
                          {service.subcontractors.map((sub) => (
                            <div key={sub.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "0.35rem", flexWrap: "wrap", gap: "0.5rem" }}>
                              <div>
                                <strong style={{ color: "var(--text-primary)" }}>{sub.name}</strong> ({sub.country}) &middot; <span style={{ color: "var(--text-secondary)" }}>{sub.serviceDescription}</span>
                              </div>
                              <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>
                                LEI: {sub.lei || "N/A"} &middot; Location: {sub.location}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add subcontractor inline form */}
                      {addingSubToServiceId === service.id && (
                        <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "rgba(22, 28, 41, 0.4)", border: "1px solid var(--border-color)", borderRadius: "6px", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                          <h4 style={{ fontSize: "0.85rem", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>Map Critical Subprocessor</h4>
                          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "0.75rem" }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: "0.7rem" }}>Subprocessor Corporate Name</label>
                              <input
                                type="text"
                                className="form-control"
                                style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem" }}
                                placeholder="e.g. Cloudflare Inc"
                                value={subName}
                                onChange={(e) => setSubName(e.target.value)}
                                required
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: "0.7rem" }}>Country (2-letter ISO)</label>
                              <input
                                type="text"
                                className="form-control"
                                style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem" }}
                                placeholder="e.g. US or DE"
                                value={subCountry}
                                onChange={(e) => setSubCountry(e.target.value)}
                                required
                              />
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "0.75rem" }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: "0.7rem" }}>Subprocessor LEI Code (Optional)</label>
                              <input
                                type="text"
                                className="form-control"
                                style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem" }}
                                placeholder="20-character ISO 17442"
                                value={subLei}
                                onChange={(e) => setSubLei(e.target.value)}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: "0.7rem" }}>Data processing Location</label>
                              <input
                                type="text"
                                className="form-control"
                                style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem" }}
                                placeholder="e.g. Global Edge Nodes"
                                value={subLocation}
                                onChange={(e) => setSubLocation(e.target.value)}
                                required
                              />
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "0.75rem" }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: "0.7rem" }}>Service Description</label>
                              <input
                                type="text"
                                className="form-control"
                                style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem" }}
                                placeholder="e.g. Edge DNS & WAF hosting"
                                value={subDesc}
                                onChange={(e) => setSubDesc(e.target.value)}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: "0.7rem" }}>Subprocessor Criticality</label>
                              <select
                                className="form-control"
                                style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem" }}
                                value={subCriticality}
                                onChange={(e) => setSubCriticality(e.target.value)}
                              >
                                <option value="CRITICAL">CRITICAL (DORA Chain Impact)</option>
                                <option value="IMPORTANT">IMPORTANT</option>
                                <option value="NON_CRITICAL">NON_CRITICAL</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.25rem" }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                              onClick={() => setAddingSubToServiceId(null)}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                              disabled={savingSub}
                              onClick={() => handleAddSubcontractor(service.id)}
                            >
                              {savingSub ? "Adding..." : "Add Subprocessor"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
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
