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

  // Step Builder and Simulation States
  const [editMode, setEditMode] = useState<"narrative" | "steps">("narrative");
  const [steps, setSteps] = useState<Array<{ id: string; title: string; description: string; estimatedMinutes: number }>>([]);
  const [newStepTitle, setNewStepTitle] = useState("");
  const [newStepDesc, setNewStepDesc] = useState("");
  const [newStepMins, setNewStepMins] = useState(30);

  const [simulating, setSimulating] = useState(false);
  const [simStepIndex, setSimStepIndex] = useState(-1);
  const [simLog, setSimLog] = useState<Array<{ time: string; event: string; status: string }>>([]);
  const [simResult, setSimResult] = useState<any | null>(null);

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
    setSimResult(null);
    setSimStepIndex(-1);
    setSimLog([]);

    const stratText = s.exitPlan?.strategy || "";
    if (stratText.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(stratText);
        if (Array.isArray(parsed)) {
          setSteps(parsed);
          setEditMode("steps");
          setTitle(s.exitPlan?.title || `Exit Strategy - ${s.supportedFunction}`);
          setStrategy("");
          setAlternativeVendor(s.exitPlan?.alternativeVendor || "");
          setStatus(s.exitPlan?.status || "DRAFT");
          setTestedDate(s.exitPlan?.testedDate ? s.exitPlan.testedDate.split("T")[0] : "");
          setReviewer(s.exitPlan?.reviewer || "");
          return;
        }
      } catch (_) {}
    }

    // Default to narrative
    setSteps([]);
    setEditMode("narrative");
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

  const handleAddStep = () => {
    if (!newStepTitle.trim()) return;
    const newStep = {
      id: Math.random().toString(36).slice(2, 9),
      title: newStepTitle,
      description: newStepDesc,
      estimatedMinutes: Number(newStepMins) || 10,
    };
    setSteps(prev => [...prev, newStep]);
    setNewStepTitle("");
    setNewStepDesc("");
    setNewStepMins(30);
  };

  const handleRemoveStep = (id: string) => {
    setSteps(prev => prev.filter(step => step.id !== id));
  };

  const handleConvertTextToSteps = () => {
    if (!strategy.trim()) return;
    const firstStep = {
      id: Math.random().toString(36).slice(2, 9),
      title: "Initial Handover Narrative",
      description: strategy,
      estimatedMinutes: 60,
    };
    setSteps([firstStep]);
    setStrategy("");
    setEditMode("steps");
  };

  const runTransitionSimulation = async () => {
    if (!selectedService) return;
    setSimulating(true);
    setSimStepIndex(0);
    setSimResult(null);
    
    const logs = [
      { time: "00:00", event: `Initiated exit transition drill for service '${selectedService.supportedFunction}'. Target Alternative: '${alternativeVendor || "In-House System"}'.`, status: "info" }
    ];
    setSimLog([...logs]);

    const stepsToRun = editMode === "steps" && steps.length > 0 
      ? steps 
      : [{ id: "narrative", title: "Executing narrative strategy migration plan", estimatedMinutes: 120 }];

    let currentStepIdx = 0;

    const interval = setInterval(async () => {
      if (currentStepIdx < stepsToRun.length) {
        const currentStep = stepsToRun[currentStepIdx];
        setSimStepIndex(currentStepIdx + 1);
        
        logs.push({
          time: `00:${String((currentStepIdx + 1) * 15).padStart(2, "0")}`,
          event: `Executing step [${currentStepIdx + 1}/${stepsToRun.length}]: "${currentStep.title}" (${currentStep.estimatedMinutes} mins estimated downtime).`,
          status: "info"
        });
        setSimLog([...logs]);
        currentStepIdx++;
      } else {
        clearInterval(interval);
        
        logs.push({
          time: "01:00",
          event: "Transition operations completed. Calculating survivability and saving drill report...",
          status: "info"
        });
        setSimLog([...logs]);

        try {
          const res = await fetch("/api/resilience/simulate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scenarioKey: "exit_plan_transition_drill",
              serviceId: selectedService.id,
            }),
          });
          const data = await res.json();
          if (data.success) {
            setSimResult(data.run);
            logs.push({
              time: "01:05",
              event: `✓ Drill successfully recorded. Survivability Rating: ${data.run.survivability}%. Status: ${data.run.status}.`,
              status: data.run.status === "COMPLETED" ? "success" : "error"
            });
            setSimLog([...logs]);
            
            // Auto update tested date to today
            setTestedDate(new Date().toISOString().split("T")[0]);
            await loadData();
          } else {
            logs.push({
              time: "01:05",
              event: `❌ Failed to save run: ${data.error}`,
              status: "error"
            });
            setSimLog([...logs]);
          }
        } catch (err) {
          logs.push({
            time: "01:05",
            event: `❌ Connection error logging run in DB.`,
            status: "error"
          });
          setSimLog([...logs]);
        } finally {
          setSimulating(false);
        }
      }
    }, 1200);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;
    setSaving(true);
    setMessage(null);

    const finalStrategy = editMode === "steps" ? JSON.stringify(steps) : strategy;

    try {
      const res = await fetch("/api/exit-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService.id,
          title,
          strategy: finalStrategy,
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
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Form header & tab switcher */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.75rem" }}>
                <h2 style={{ fontSize: "1.2rem", margin: 0 }}>
                  continuity Strategy Plan
                </h2>
                <div style={{ display: "flex", gap: "0.25rem", backgroundColor: "rgba(0,0,0,0.25)", padding: "2px", borderRadius: "4px" }}>
                  <button
                    type="button"
                    onClick={() => setEditMode("narrative")}
                    style={{
                      padding: "0.3rem 0.6rem",
                      fontSize: "0.75rem",
                      border: "none",
                      borderRadius: "3px",
                      backgroundColor: editMode === "narrative" ? "var(--color-brand)" : "transparent",
                      color: editMode === "narrative" ? "#000" : "var(--text-secondary)",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Narrative Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMode("steps")}
                    style={{
                      padding: "0.3rem 0.6rem",
                      fontSize: "0.75rem",
                      border: "none",
                      borderRadius: "3px",
                      backgroundColor: editMode === "steps" ? "var(--color-brand)" : "transparent",
                      color: editMode === "steps" ? "#000" : "var(--text-secondary)",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Step Builder
                  </button>
                </div>
              </div>

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

              <div style={{ display: "flex", gap: "1rem", fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "-0.5rem" }}>
                <span>Function: <strong>{selectedService.supportedFunction}</strong></span>
                <span>&middot;</span>
                <span>Vendor: <strong>{selectedService.vendor.legalName}</strong></span>
              </div>

              <form onSubmit={handleSavePlan} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
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

                {editMode === "narrative" ? (
                  <div className="form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                      <label className="form-label" style={{ margin: 0 }}>Exit strategy Details & Handover Operations</label>
                      {strategy.trim() && (
                        <button
                          type="button"
                          onClick={handleConvertTextToSteps}
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--color-brand)",
                            backgroundColor: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: 0
                          }}
                        >
                          ⚡ Convert to Steps
                        </button>
                      )}
                    </div>
                    <textarea
                      className="form-control"
                      style={{ minHeight: "150px", fontFamily: "inherit" }}
                      required
                      placeholder="Describe step-by-step how the data will be exported, how continuous business operations are assured during migration, and cut-over testing processes."
                      value={strategy}
                      onChange={(e) => setStrategy(e.target.value)}
                    />
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Sequential Transition Steps ({steps.length})</label>
                    
                    {steps.length === 0 ? (
                      <div style={{ padding: "1.5rem", border: "1px dashed var(--border-color)", borderRadius: "6px", textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        No steps defined yet. Use the fields below to add your first sequential migration step.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "250px", overflowY: "auto", paddingRight: "0.25rem" }}>
                        {steps.map((step, idx) => (
                          <div
                            key={step.id}
                            style={{
                              padding: "0.6rem 0.8rem",
                              borderRadius: "4px",
                              backgroundColor: "rgba(22, 28, 41, 0.2)",
                              border: "1px solid var(--border-color)",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "0.5rem"
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", flex: 1 }}>
                              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)" }}>
                                {idx + 1}. {step.title} ({step.estimatedMinutes} mins)
                              </span>
                              {step.description && (
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                  {step.description}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveStep(step.id)}
                              style={{
                                border: "none",
                                background: "none",
                                color: "var(--color-error)",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                                fontWeight: 600
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Step Adder Form */}
                    <div style={{ padding: "0.8rem", backgroundColor: "rgba(0,0,0,0.15)", borderRadius: "6px", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      <strong style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Add Sequential Task</strong>
                      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: "0.5rem" }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Export Backup PostgreSQL dump"
                          value={newStepTitle}
                          onChange={(e) => setNewStepTitle(e.target.value)}
                          style={{ padding: "0.3rem 0.5rem", fontSize: "0.75rem" }}
                        />
                        <input
                          type="number"
                          className="form-control"
                          placeholder="Minutes"
                          value={newStepMins}
                          onChange={(e) => setNewStepMins(Number(e.target.value) || 0)}
                          style={{ padding: "0.3rem 0.5rem", fontSize: "0.75rem" }}
                          min="1"
                        />
                      </div>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Optional task instructions or details..."
                        value={newStepDesc}
                        onChange={(e) => setNewStepDesc(e.target.value)}
                        style={{ padding: "0.3rem 0.5rem", fontSize: "0.75rem" }}
                      />
                      <button
                        type="button"
                        onClick={handleAddStep}
                        className="btn btn-secondary"
                        style={{ padding: "0.3rem", fontSize: "0.75rem", width: "fit-content", alignSelf: "flex-end" }}
                      >
                        + Add Step
                      </button>
                    </div>
                  </div>
                )}

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
                    <option value="APPROVED">APPROVED (Passes policy validation)</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={runTransitionSimulation}
                    className="btn btn-secondary"
                    style={{
                      border: "1px solid var(--color-brand)",
                      color: "var(--color-brand)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem"
                    }}
                    disabled={simulating}
                  >
                    ⚡ Run Transition Drill
                  </button>

                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? "Saving Continuity strategy..." : "Save exit strategy Plan"}
                  </button>
                </div>
              </form>

              {/* Transition Simulation Console */}
              {simStepIndex >= 0 && (
                <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border-color)", paddingTop: "1rem" }}>
                  <h3 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                    Sequential Continuity Simulator Log
                  </h3>

                  {simulating && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <div className="spinner" style={{ width: "0.85rem", height: "0.85rem" }} />
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        Step {simStepIndex} of {editMode === "steps" && steps.length > 0 ? steps.length : 1} running...
                      </span>
                    </div>
                  )}

                  <div
                    style={{
                      backgroundColor: "rgba(4, 6, 10, 0.75)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "6px",
                      padding: "0.75rem",
                      maxHeight: "180px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                      fontFamily: "monospace",
                      fontSize: "0.75rem",
                      lineHeight: "1.3"
                    }}
                  >
                    {simLog.map((log, idx) => {
                      let color = "var(--text-secondary)";
                      if (log.status === "success") color = "var(--color-brand)";
                      else if (log.status === "error") color = "var(--color-error)";

                      return (
                        <div key={idx} style={{ display: "flex", gap: "0.5rem" }}>
                          <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>[{log.time}]</span>
                          <span style={{ color }}>{log.event}</span>
                        </div>
                      );
                    })}
                  </div>

                  {simResult && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color)", padding: "0.75rem", borderRadius: "6px", marginTop: "0.75rem" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        Drill Result: <strong style={{ color: simResult.status === "COMPLETED" ? "var(--color-brand)" : "var(--color-error)" }}>{simResult.status}</strong>
                      </span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: simResult.survivability >= 60 ? "var(--color-brand)" : "var(--color-error)" }}>
                        {simResult.survivability}% Survivability
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
