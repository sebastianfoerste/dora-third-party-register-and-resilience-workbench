"use client";

import { useEffect, useState } from "react";

interface ExitPlan {
  id: string;
  title: string;
  strategy: string;
  testedDate: string | null;
  alternativeVendor: string | null;
  status: string;
  reviewer: string | null;
}

interface Service {
  id: string;
  supportedFunction: string;
  serviceDescription: string;
  exitPlanStatus: string;
  vendor: {
    legalName: string;
  };
  exitPlan: ExitPlan | null;
}

export default function ExitPlansPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [strategy, setStrategy] = useState("");
  const [alternativeVendor, setAlternativeVendor] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [testedDate, setTestedDate] = useState("");
  const [reviewer, setReviewer] = useState("");

  const loadData = async () => {
    try {
      const res = await fetch("/api/exit-plans");
      const data = await res.json();
      if (data.success && data.services) {
        setServices(data.services);
        // Refresh selected service if active
        if (selectedService) {
          const updated = data.services.find((s: Service) => s.id === selectedService.id);
          if (updated) setSelectedService(updated);
        }
      }
    } catch (err) {
      console.error("Failed to load services:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectService = (s: Service) => {
    setSelectedService(s);
    setMessage(null);
    if (s.exitPlan) {
      setTitle(s.exitPlan.title || "");
      setStrategy(s.exitPlan.strategy || "");
      setAlternativeVendor(s.exitPlan.alternativeVendor || "");
      setStatus(s.exitPlan.status || "DRAFT");
      setTestedDate(s.exitPlan.testedDate ? s.exitPlan.testedDate.split("T")[0] : "");
      setReviewer(s.exitPlan.reviewer || "");
    } else {
      setTitle(`Exit Strategy - ${s.supportedFunction}`);
      setStrategy("");
      setAlternativeVendor("");
      setStatus("DRAFT");
      setTestedDate("");
      setReviewer("");
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/exit-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService.id,
          title,
          strategy,
          alternativeVendor,
          status,
          testedDate: testedDate || null,
          reviewer: reviewer || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage("✓ Exit strategy successfully saved and compliance score recalculated.");
        await loadData();
      } else {
        setMessage("❌ Failed to save exit plan: " + data.error);
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Network error saving exit plan.");
    } finally {
      setSaving(false);
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
        <h1 className="page-title">Exit & Continuity Strategies</h1>
        <p className="page-subtitle">
          Draft and audit transition strategies to prevent lock-in and secure vendor exit actions under DORA Article 30(2)(h).
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "2.5rem" }}>
        
        {/* Left Column: Services list */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem", height: "fit-content" }}>
          <h2 style={{ fontSize: "1.2rem", margin: 0 }}>ICT Services Continuity List</h2>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0 }}>
            Select an ICT service to review its exit plan or compose a new strategy manifest.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "60vh", overflowY: "auto", paddingRight: "0.5rem" }}>
            {services.map((s) => {
              const isActive = selectedService?.id === s.id;
              let badgeClass = "badge danger";
              if (s.exitPlanStatus === "APPROVED") badgeClass = "badge success";
              else if (s.exitPlanStatus === "DRAFT" || s.exitPlanStatus === "UNDER_REVIEW") badgeClass = "badge warning";

              return (
                <div
                  key={s.id}
                  onClick={() => handleSelectService(s)}
                  style={{
                    padding: "1rem",
                    borderRadius: "6px",
                    backgroundColor: isActive ? "rgba(0, 229, 255, 0.05)" : "rgba(22, 28, 41, 0.2)",
                    border: isActive ? "1px solid var(--color-brand)" : "1px solid var(--border-color)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                      {s.supportedFunction}
                    </span>
                    <span className={badgeClass} style={{ fontSize: "0.7rem", fontWeight: 700 }}>
                      {s.exitPlanStatus || "NONE"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    <span>Vendor: {s.vendor.legalName}</span>
                    <span>{s.exitPlan?.testedDate ? `Tested: ${new Date(s.exitPlan.testedDate).toLocaleDateString()}` : "Untested"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Editor Form */}
        <div className="card" style={{ height: "fit-content" }}>
          {!selectedService ? (
            <div style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--text-muted)" }}>
              <svg
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                style={{ width: "3rem", height: "3rem", margin: "0 auto 1.5rem auto", opacity: 0.5, color: "var(--color-brand)" }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                Select an ICT Service
              </h3>
              <p style={{ fontSize: "0.85rem", maxWidth: "300px", margin: "0 auto" }}>
                Choose a service from the left list to compose, review, or approve its regulatory exit continuity plan.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSavePlan} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <h2 style={{ fontSize: "1.2rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.75rem", margin: 0 }}>
                continuity Strategy Plan
              </h2>

              {message && (
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "4px",
                    backgroundColor: message.startsWith("✓") ? "rgba(20, 184, 166, 0.08)" : "rgba(239, 68, 68, 0.08)",
                    border: message.startsWith("✓") ? "1px solid rgba(20, 184, 166, 0.2)" : "1px solid rgba(239, 68, 68, 0.2)",
                    color: message.startsWith("✓") ? "var(--color-brand)" : "var(--color-error)",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                  }}
                >
                  {message}
                </div>
              )}

              <div style={{ display: "flex", gap: "1rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                <span>Function: <strong>{selectedService.supportedFunction}</strong></span>
                <span>&middot;</span>
                <span>Vendor: <strong>{selectedService.vendor.legalName}</strong></span>
              </div>

              <div className="form-group">
                <label className="form-label">Exit Strategy Title</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="e.g. Transaction Ledger Migration Plan"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Alternative Vendor / Fallback Platform</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Equinix Germany GmbH"
                  value={alternativeVendor}
                  onChange={(e) => setAlternativeVendor(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Exit strategy Details & Handover Operations</label>
                <textarea
                  className="form-control"
                  style={{ minHeight: "150px", fontFamily: "inherit" }}
                  required
                  placeholder="Describe step-by-step how the data will be exported, how continuous business operations are assured during migration, and cut-over testing processes."
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">Last Continuity Test Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={testedDate}
                    onChange={(e) => setTestedDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Continuity Reviewer / CCO</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Chief Compliance Officer"
                    value={reviewer}
                    onChange={(e) => setReviewer(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Approval Status</label>
                <select
                  className="form-control"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="DRAFT">DRAFT (Fails active policy validation)</option>
                  <option value="UNDER_REVIEW">UNDER_REVIEW (Fails active policy validation)</option>
                  <option value="APPROVED">CCO-APPROVED (Passes policy validation)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving Continuity strategy..." : "Save exit strategy Plan"}
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
