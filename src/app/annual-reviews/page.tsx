"use client";

import { useEffect, useState } from "react";

interface ReviewCycle {
  id: string;
  reviewedAt: string;
  reviewer: string;
  notes: string | null;
  status: string;
}

interface RegisterEntry {
  id: string;
  legalEntityId: string;
  legalEntity: { name: string; licenceType: string };
  vendorId: string;
  vendor: { legalName: string };
  serviceId: string;
  service: { supportedFunction: string };
  criticality: string;
  validationStatus: string;
  lastReviewedAt: string | null;
  nextReviewDue: string | null;
  reviewerNotes: string | null;
  reviewHistory: ReviewCycle[];
}

export default function AnnualReviewsPage() {
  const [entries, setEntries] = useState<RegisterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingEntry, setSigningEntry] = useState<RegisterEntry | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await fetch("/api/annual-reviews");
      const data = await res.json();
      if (data.success) {
        setEntries(data.entries);
      }
    } catch (err) {
      console.error("Failed to load annual reviews:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenSignOff = (entry: RegisterEntry) => {
    setSigningEntry(entry);
    setReviewer("");
    setNotes("");
    setMessage(null);
  };

  const handleSignOffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signingEntry) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/annual-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registerEntryId: signingEntry.id,
          reviewer,
          notes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage(`✓ Annual review completed for ${signingEntry.vendor.legalName}.`);
        setSigningEntry(null);
        await loadData();
      } else {
        setMessage("❌ Failed to complete review: " + data.error);
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Network error submitting review.");
    } finally {
      setSaving(false);
    }
  };

  // Status computation for each entry
  const getReviewStatus = (entry: RegisterEntry) => {
    if (!entry.nextReviewDue) return { text: "UNSCHEDULED", color: "var(--text-muted)", severity: "neutral" };
    const today = new Date();
    const due = new Date(entry.nextReviewDue);
    if (due.getTime() < today.getTime()) {
      return { text: "OVERDUE", color: "var(--color-error)", severity: "danger" };
    }
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 30) {
      return { text: `DUE IN ${diffDays} DAYS`, color: "var(--color-warning)", severity: "warning" };
    }
    return { text: "CURRENT", color: "var(--color-brand)", severity: "success" };
  };

  // Metrics
  const overdueCount = entries.filter((e) => getReviewStatus(e).severity === "danger").length;
  const imminentCount = entries.filter((e) => getReviewStatus(e).severity === "warning").length;
  const currentCount = entries.filter((e) => getReviewStatus(e).severity === "success").length;

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
        <h1 className="page-title">Annual Registry Review Cycle</h1>
        <p className="page-subtitle">
          DORA Article 30(1) requires financial entities to review and update their Register of Information on contractual arrangements at least once a year.
        </p>
      </div>

      {message && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "4px",
            backgroundColor: "rgba(20, 184, 166, 0.08)",
            border: "1px solid rgba(20, 184, 166, 0.2)",
            color: "var(--color-brand)",
            fontSize: "0.85rem",
            fontWeight: 500,
            marginBottom: "1.5rem",
          }}
        >
          {message}
        </div>
      )}

      {/* Metrics Banner */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem", marginBottom: "2rem" }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", borderLeft: "4px solid var(--color-error)" }}>
          <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)" }}>Overdue Reviews</span>
          <span style={{ fontSize: "1.75rem", fontWeight: 700, color: overdueCount > 0 ? "var(--color-error)" : "var(--text-primary)" }}>{overdueCount}</span>
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", borderLeft: "4px solid var(--color-warning)" }}>
          <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)" }}>Due Within 30 Days</span>
          <span style={{ fontSize: "1.75rem", fontWeight: 700, color: imminentCount > 0 ? "var(--color-warning)" : "var(--text-primary)" }}>{imminentCount}</span>
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", borderLeft: "4px solid var(--color-brand)" }}>
          <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)" }}>Fully Current Entries</span>
          <span style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--color-brand)" }}>{currentCount}</span>
        </div>
      </div>

      {/* Main Layout: List of Entries */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem", alignItems: "flex-start" }}>
        
        {/* Left Side: Register entries table */}
        <div className="card">
          <h2 style={{ fontSize: "1.1rem", marginBottom: "1.25rem" }}>Register Entries Status</h2>
          
          <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)", textAlign: "left" }}>
                <th style={{ padding: "0.75rem 0.5rem", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)" }}>ICT Service & Vendor</th>
                <th style={{ padding: "0.75rem 0.5rem", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)" }}>Legal Entity</th>
                <th style={{ padding: "0.75rem 0.5rem", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)" }}>Next Review Due</th>
                <th style={{ padding: "0.75rem 0.5rem", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)" }}>Review Status</th>
                <th style={{ padding: "0.75rem 0.5rem", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const status = getReviewStatus(entry);
                return (
                  <tr key={entry.id} style={{ borderBottom: "1px solid var(--border-color)", fontSize: "0.85rem" }}>
                    <td style={{ padding: "0.75rem 0.5rem" }}>
                      <strong style={{ display: "block", color: "var(--text-primary)" }}>{entry.service.supportedFunction}</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{entry.vendor.legalName}</span>
                    </td>
                    <td style={{ padding: "0.75rem 0.5rem" }}>
                      <span style={{ display: "block" }}>{entry.legalEntity.name}</span>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>({entry.legalEntity.licenceType})</span>
                    </td>
                    <td style={{ padding: "0.75rem 0.5rem", color: "var(--text-secondary)" }}>
                      {entry.nextReviewDue ? new Date(entry.nextReviewDue).toLocaleDateString() : "Unscheduled"}
                    </td>
                    <td style={{ padding: "0.75rem 0.5rem" }}>
                      <span style={{ color: status.color, fontWeight: 600, fontSize: "0.75rem" }}>
                        {status.text}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
                        onClick={() => handleOpenSignOff(entry)}
                      >
                        Sign Off Review
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right Side: Quick History Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Sign Off Review Box */}
          {signingEntry && (
            <div className="card" style={{ border: "1px solid var(--color-brand)" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 1rem 0" }}>
                Annual Review Sign-Off
              </h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                You are logging a compliance review for the ICT contract with <strong>{signingEntry.vendor.legalName}</strong> supporting <strong>{signingEntry.service.supportedFunction}</strong>.
              </p>
              
              <form onSubmit={handleSignOffSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: "0.75rem" }}>Reviewer Name</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: "0.8rem" }}
                    placeholder="e.g. Chief Compliance Officer"
                    required
                    value={reviewer}
                    onChange={(e) => setReviewer(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: "0.75rem" }}>Compliance Notes</label>
                  <textarea
                    className="form-control"
                    style={{ minHeight: "80px", fontSize: "0.8rem", fontFamily: "inherit" }}
                    placeholder="Provide details on findings, contract amendments, or service level checks completed during this review cycle."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button type="button" className="btn btn-secondary" style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }} onClick={() => setSigningEntry(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }} disabled={saving}>
                    {saving ? "Signing..." : "Complete Sign-off"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Review History Logs */}
          <div className="card">
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 1rem 0" }}>Historical Review Logs</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {entries.flatMap((entry) => 
                entry.reviewHistory.map((hist) => ({
                  ...hist,
                  vendorName: entry.vendor.legalName,
                  serviceName: entry.service.supportedFunction,
                }))
              )
              .sort((a,b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime())
              .slice(0, 5)
              .map((h, i) => (
                <div key={i} style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem", fontSize: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                    <span>Reviewed: {new Date(h.reviewedAt).toLocaleDateString()}</span>
                    <strong>{h.reviewer}</strong>
                  </div>
                  <strong style={{ display: "block", color: "var(--text-secondary)", margin: "0.2rem 0" }}>
                    {h.vendorName}, {h.serviceName}
                  </strong>
                  <p style={{ color: "var(--text-muted)", margin: 0, fontStyle: "italic" }}>
                    &ldquo;{h.notes || "No notes logged."}&rdquo;
                  </p>
                </div>
              ))}
              {entries.every(e => e.reviewHistory.length === 0) && (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "1rem 0", fontSize: "0.75rem" }}>
                  No historical reviews logged.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
