"use client";

import { useEffect, useState } from "react";

interface Service {
  id: string;
  supportedFunction: string;
  vendor: {
    id: string;
    legalName: string;
  };
  criticalityAssessments: Array<{ result: string }>;
}

interface ResilienceTest {
  id: string;
  serviceId: string;
  testType: string;
  testDate: string;
  status: "PASSED" | "FAILED" | "PENDING";
  findingsCount: number;
  evidenceSummary: string;
  nextScheduledDate: string | null;
  service: Service;
}

interface ThreatIntel {
  id: string;
  vendorId: string;
  cveId: string;
  description: string;
  severity: string; // HIGH, MEDIUM, LOW
  status: string; // UNPATCHED, PATCHED
  detectedAt: string;
  vendor: {
    legalName: string;
  };
}

interface SimulationRun {
  id: string;
  scenarioName: string;
  status: string; // COMPLETED, FAILED
  survivability: number;
  timelineLog: string; // JSON timeline
  testedAt: string;
}

export default function ResiliencePage() {
  const [tests, setTests] = useState<ResilienceTest[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [threats, setThreats] = useState<ThreatIntel[]>([]);
  const [simulations, setSimulations] = useState<SimulationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Form State for logging test
  const [serviceId, setServiceId] = useState("");
  const [testType, setTestType] = useState("VULNERABILITY_ASSESSMENT");
  const [testDate, setTestDate] = useState("");
  const [status, setStatus] = useState<"PASSED" | "FAILED" | "PENDING">("PASSED");
  const [findingsCount, setFindingsCount] = useState(0);
  const [evidenceSummary, setEvidenceSummary] = useState("");

  // Simulator States
  const [simulating, setSimulating] = useState(false);
  const [simScenario, setSimScenario] = useState("ledger_aws_outage");
  const [simServiceId, setSimServiceId] = useState("");
  const [activeRunResult, setActiveRunResult] = useState<SimulationRun | null>(null);

  // SBOM Scanner States
  const [sbomInput, setSbomInput] = useState("");
  const [sbomScanResults, setSbomScanResults] = useState<Array<{ depName: string; version: string; threat: ThreatIntel }>>([]);
  const [sbomScanRan, setSbomScanRan] = useState(false);
  const [sbomErrors, setSbomErrors] = useState<string | null>(null);
  const [createdTasks, setCreatedTasks] = useState<Record<string, boolean>>({});

  // Threat Ingestion Form States
  const [showThreatForm, setShowThreatForm] = useState(false);
  const [ingestVendorId, setIngestVendorId] = useState("");
  const [ingestCveId, setIngestCveId] = useState("");
  const [ingestDesc, setIngestDesc] = useState("");
  const [ingestSeverity, setIngestSeverity] = useState("HIGH");
  const [ingestStatus, setIngestStatus] = useState("UNPATCHED");
  const [ingestSaving, setIngestSaving] = useState(false);

  const handleIngestThreat = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeVendorId = ingestVendorId || (services[0]?.vendor.id || "");
    if (!activeVendorId || !ingestCveId || !ingestDesc) {
      alert("Please fill all threat fields.");
      return;
    }
    setIngestSaving(true);
    try {
      const res = await fetch("/api/resilience/threats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: activeVendorId,
          cveId: ingestCveId,
          description: ingestDesc,
          severity: ingestSeverity,
          status: ingestStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIngestCveId("");
        setIngestDesc("");
        setShowThreatForm(false);
        setMessage(`✓ Security Threat ${data.threat.cveId} successfully ingested.`);
        await loadData();
      } else {
        alert(data.error || "Failed to ingest CVE.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error ingesting CVE.");
    } finally {
      setIngestSaving(false);
    }
  };

  const handleRunSbomScan = () => {
    setSbomErrors(null);
    setSbomScanResults([]);
    setSbomScanRan(true);
    try {
      const parsed = JSON.parse(sbomInput);
      const deps = { ...parsed.dependencies, ...parsed.devDependencies };
      
      const results: Array<{ depName: string; version: string; threat: ThreatIntel }> = [];
      Object.entries(deps).forEach(([depName, version]) => {
        threats.forEach((threat) => {
          const matchTarget = (threat.description + " " + threat.cveId).toLowerCase();
          if (matchTarget.includes(depName.toLowerCase())) {
            results.push({ depName, version: String(version), threat });
          }
        });
      });
      setSbomScanResults(results);
    } catch (err: any) {
      setSbomErrors("Invalid package.json structure: " + err.message);
    }
  };

  const handleCreateSbomRemediation = async (result: { depName: string; version: string; threat: ThreatIntel }) => {
    try {
      const response = await fetch("/api/remediation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Patch vulnerability ${result.threat.cveId} in ${result.depName}`,
          description: `A dependency match was detected in the tech stack SBOM scan. The dependency ${result.depName} (version: ${result.version}) is vulnerable to ${result.threat.cveId}: ${result.threat.description}. Action is required to upgrade or patch this dependency.`,
          owner: "security-team@solaris-group.com",
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          severity: result.threat.severity,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setCreatedTasks(prev => ({ ...prev, [result.threat.id + "-" + result.depName]: true }));
        setMessage("✓ Remediation task successfully created for " + result.threat.cveId);
      } else {
        alert(data.error || "Failed to create task.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error creating remediation task.");
    }
  };


  const loadData = async () => {
    try {
      const res = await fetch("/api/resilience");
      const data = await res.json();
      if (data.success) {
        setTests(data.tests);
        setServices(data.services);
        setThreats(data.threatIntel || []);
        setSimulations(data.simulations || []);
        
        // Auto-select first service for simulator if not set
        if (data.services.length > 0 && !simServiceId) {
          setSimServiceId(data.services[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load resilience tests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenForm = () => {
    setServiceId(services[0]?.id || "");
    setTestType("VULNERABILITY_ASSESSMENT");
    setTestDate(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
    setStatus("PASSED");
    setFindingsCount(0);
    setEvidenceSummary("");
    setShowForm(true);
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/resilience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          testType,
          testDate,
          status,
          findingsCount,
          evidenceSummary,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage("✓ Resilience test evidence successfully logged.");
        await loadData();
        setShowForm(false);
      } else {
        setMessage("❌ Failed to log test: " + data.error);
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Network error saving resilience test.");
    } finally {
      setSaving(false);
    }
  };

  const handleRunSimulation = async () => {
    if (!simServiceId || !simScenario) return;
    setSimulating(true);
    setActiveRunResult(null);

    try {
      const res = await fetch("/api/resilience/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioKey: simScenario,
          serviceId: simServiceId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActiveRunResult(data.run);
        await loadData(); // Refresh history
      } else {
        alert("Failed to run simulation: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Error invoking simulation engine.");
    } finally {
      setSimulating(false);
    }
  };

  // Identify DORA Gaps (Critical services missing tests or outdated)
  const criticalServices = services.filter(
    (s) =>
      s.supportedFunction === "Core Transaction Ledger" ||
      s.supportedFunction === "Crypto Asset Custody Key Management" ||
      s.supportedFunction === "Fiat/Crypto Gateway Liquidity"
  );

  const testAlerts: Array<{ serviceName: string; vendorName: string; reason: string }> = [];

  criticalServices.forEach((s) => {
    const serviceTests = tests.filter((t) => t.serviceId === s.id);
    if (serviceTests.length === 0) {
      testAlerts.push({
        serviceName: s.supportedFunction,
        vendorName: s.vendor.legalName,
        reason: "No resilience testing evidence recorded in the database.",
      });
    } else {
      const latest = [...serviceTests].sort(
        (a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime()
      )[0];
      if (latest.status === "FAILED") {
        testAlerts.push({
          serviceName: s.supportedFunction,
          vendorName: s.vendor.legalName,
          reason: `Latest test (${latest.testType} on ${new Date(latest.testDate).toLocaleDateString()}) FAILED with open findings.`,
        });
      } else {
        const testAgeDays = Math.ceil(
          (new Date().getTime() - new Date(latest.testDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (testAgeDays > 365) {
          testAlerts.push({
            serviceName: s.supportedFunction,
            vendorName: s.vendor.legalName,
            reason: `Latest passed test is outdated (${testAgeDays} days old). DORA requires annual re-testing.`,
          });
        }
      }
    }
  });

  const totalTests = tests.length;
  const passedTestsCount = tests.filter((t) => t.status === "PASSED").length;
  const failedTestsCount = tests.filter((t) => t.status === "FAILED").length;

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 className="page-title">Resilience & Security Testing Hub</h1>
          <p className="page-subtitle">
            Execute stress simulations, track active vulnerability threat feeds, and record Article 24 test compliance logs.
          </p>
        </div>
        {!showForm && (
          <button className="btn btn-primary" onClick={handleOpenForm}>
            + Log Test Evidence
          </button>
        )}
      </div>

      {message && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "4px",
            backgroundColor: message.startsWith("✓") ? "rgba(20, 184, 166, 0.08)" : "rgba(239, 68, 68, 0.08)",
            border: message.startsWith("✓") ? "1px solid rgba(20, 184, 166, 0.2)" : "1px solid rgba(239, 68, 68, 0.2)",
            color: message.startsWith("✓") ? "var(--color-brand)" : "var(--color-error)",
            fontSize: "0.85rem",
            fontWeight: 500,
            marginBottom: "1.5rem",
          }}
        >
          {message}
        </div>
      )}

      {/* Grid of Alert Warnings & Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1.5rem", marginBottom: "2rem" }}>
        
        {/* Warnings Card */}
        <div className="card" style={{ borderLeft: testAlerts.length > 0 ? "4px solid var(--color-error)" : "4px solid var(--color-brand)" }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 600, margin: "0 0 1rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {testAlerts.length > 0 ? (
              <>
                <span className="pulse-red" style={{ display: "inline-block" }} />
                <span style={{ color: "var(--color-error)" }}>{testAlerts.length} Resilience Warnings Detected</span>
              </>
            ) : (
              <span style={{ color: "var(--color-brand)" }}>✓ All Critical Services Tested & Current</span>
            )}
          </h2>
          {testAlerts.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
              All mapped critical services have valid resilience testing records logged within the 365-day compliance cycle.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {testAlerts.map((alt, idx) => (
                <div key={idx} style={{ backgroundColor: "rgba(239, 68, 68, 0.04)", border: "1px solid rgba(239, 68, 68, 0.12)", padding: "0.6rem 0.8rem", borderRadius: "4px" }}>
                  <strong style={{ fontSize: "0.8rem", color: "var(--text-primary)" }}>{alt.vendorName} &mdash; {alt.serviceName}</strong>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0.2rem 0 0 0" }}>{alt.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 1rem 0" }}>Resilience Index</h3>
          <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}>
            <div>
              <span style={{ display: "block", fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)" }}>{totalTests}</span>
              <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Logged</span>
            </div>
            <div>
              <span style={{ display: "block", fontSize: "1.75rem", fontWeight: 700, color: "var(--color-brand)" }}>{passedTestsCount}</span>
              <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Passed</span>
            </div>
            <div>
              <span style={{ display: "block", fontSize: "1.75rem", fontWeight: 700, color: failedTestsCount > 0 ? "var(--color-error)" : "var(--text-muted)" }}>{failedTestsCount}</span>
              <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Failed</span>
            </div>
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", borderTop: "1px solid var(--border-color)", paddingTop: "0.5rem", marginTop: "1rem", textAlign: "center" }}>
            Audit compliance cycle: <strong>365 Days</strong>
          </div>
        </div>
      </div>

      {showForm ? (
        <div className="card" style={{ maxWidth: "600px", margin: "0 auto 2rem auto" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <h2 style={{ fontSize: "1.1rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem", margin: 0 }}>
              Log Resilience Test Evidence
            </h2>

            <div className="form-group">
              <label className="form-label">ICT Service & Provider</label>
              <select
                className="form-control"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                required
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.vendor.legalName} &mdash; {s.supportedFunction}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Test Type</label>
                <select
                  className="form-control"
                  value={testType}
                  onChange={(e) => setTestType(e.target.value)}
                >
                  <option value="VULNERABILITY_ASSESSMENT">Vulnerability Assessment / Scan</option>
                  <option value="PENETRATION_TEST">Penetration Test (Internal/External)</option>
                  <option value="SCENARIO_DR">Disaster Recovery (DR) Scenario Drill</option>
                  <option value="TLPT">Threat Led Penetration Testing (TLPT / Red Team)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Test Date</label>
                <input
                  type="date"
                  className="form-control"
                  required
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Audit Outcome / Status</label>
                <select
                  className="form-control"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="PASSED">PASSED / NOMINAL</option>
                  <option value="FAILED">FAILED / OPEN FINDINGS</option>
                  <option value="PENDING">PENDING REPORT REVIEW</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Vulnerability Findings Count</label>
                <input
                  type="number"
                  className="form-control"
                  min="0"
                  value={findingsCount}
                  onChange={(e) => setFindingsCount(parseInt(e.target.value, 10) || 0)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Evidence & Scope Summary</label>
              <textarea
                className="form-control"
                style={{ minHeight: "100px", fontFamily: "inherit" }}
                required
                placeholder="Describe scope, parameters of the testing scenario, tools utilized, and specific compliance certificates uploaded."
                value={evidenceSummary}
                onChange={(e) => setEvidenceSummary(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Save Test Evidence"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Main split work space layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "2rem", alignItems: "start" }}>
        
        {/* Left Side: Test Timelines & Simulation History */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Timeline of tests */}
          <div className="card">
            <h2 style={{ fontSize: "1.1rem", marginBottom: "1.25rem" }}>Logged Resilience Evidence Timeline</h2>
            {tests.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                No resilience test evidence recorded.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {tests.map((test) => {
                  let outcomeBadge = "badge info";
                  if (test.status === "PASSED") outcomeBadge = "badge success";
                  else if (test.status === "FAILED") outcomeBadge = "badge danger";

                  return (
                    <div
                      key={test.id}
                      style={{
                        padding: "1rem",
                        borderRadius: "6px",
                        backgroundColor: "rgba(22, 28, 41, 0.2)",
                        border: "1px solid var(--border-color)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "1.5rem",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span className={outcomeBadge} style={{ fontSize: "0.65rem", fontWeight: 700 }}>
                            {test.status}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {new Date(test.testDate).toLocaleDateString()}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "var(--color-brand)" }}>
                            {test.testType.replace(/_/g, " ")}
                          </span>
                        </div>
                        <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)", marginTop: "0.3rem" }}>
                          {test.service.supportedFunction} &middot; <span style={{ color: "var(--text-secondary)" }}>{test.service.vendor.legalName}</span>
                        </h3>
                        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0.4rem 0 0 0", lineHeight: "1.4" }}>
                          {test.evidenceSummary}
                        </p>
                      </div>
                      <div style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--text-muted)", minWidth: "120px" }}>
                        <div>Findings: <strong>{test.findingsCount} Vulnerabilities</strong></div>
                        {test.nextScheduledDate && (
                          <div style={{ marginTop: "0.2rem" }}>
                            Next scan: <strong>{new Date(test.nextScheduledDate).toLocaleDateString()}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Simulation Runs History */}
          <div className="card">
            <h2 style={{ fontSize: "1.1rem", marginBottom: "1.25rem" }}>Scenario Simulation Run Logs</h2>
            {simulations.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                No scenario simulations executed yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {simulations.map((sim) => (
                  <div
                    key={sim.id}
                    style={{
                      padding: "0.85rem 1rem",
                      borderRadius: "6px",
                      border: "1px solid rgba(255, 255, 255, 0.04)",
                      backgroundColor: "rgba(3, 5, 9, 0.2)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>{sim.scenarioName}</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.75rem" }}>
                        {new Date(sim.testedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span className={`badge ${sim.status === "COMPLETED" ? "success" : "danger"}`} style={{ fontSize: "0.65rem" }}>
                        {sim.status}
                      </span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: sim.survivability >= 60 ? "var(--color-brand)" : "var(--color-error)" }}>
                        {sim.survivability}% Survivability
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Scenario Simulator & Active Threat Feed */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Active DR Simulator Widget */}
          <div className="card" style={{ borderTop: "2px solid var(--color-brand)" }}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Resilience Scenario Simulator</h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
              Run simulated system disruptions to stress-test exit strategies and SLA response frameworks.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Select Drill Scenario</label>
                <select
                  className="form-control"
                  value={simScenario}
                  onChange={(e) => setSimScenario(e.target.value)}
                >
                  <option value="ledger_aws_outage">Cloud Host Region Outage (Frankfurt)</option>
                  <option value="kyc_subprocessor_leak">Subcontractor Data Leak (US/UK)</option>
                  <option value="general_ddos">Distributed Denial of Service (DDoS) Attack</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Target Regulated Service</label>
                <select
                  className="form-control"
                  value={simServiceId}
                  onChange={(e) => setSimServiceId(e.target.value)}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.supportedFunction} ({s.vendor.legalName})
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleRunSimulation}
                disabled={simulating || !simServiceId}
                style={{ marginTop: "0.5rem" }}
              >
                {simulating ? "Executing Stress Scenario..." : "⚡ Execute Resilience Scenario"}
              </button>
            </div>

            {/* Simulation live/terminal log */}
            {simulating && (
              <div style={{ textAlign: "center", padding: "1.5rem", backgroundColor: "rgba(0,0,0,0.3)", borderRadius: "6px" }}>
                <div className="spinner" style={{ margin: "0 auto 1rem auto" }} />
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", animation: "pulse 1.2s infinite" }}>
                  Calculating contractual limits, residency parameters, and fallback timelines...
                </span>
              </div>
            )}

            {activeRunResult && (
              <div
                style={{
                  backgroundColor: "rgba(4, 6, 10, 0.75)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  padding: "1rem",
                  animation: "slideUp 0.3s ease-out"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>Simulation Result</span>
                  <span
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: activeRunResult.survivability >= 60 ? "var(--color-brand)" : "var(--color-error)"
                    }}
                  >
                    {activeRunResult.survivability}% Survivability
                  </span>
                </div>

                {/* Timeline display */}
                <div
                  style={{
                    maxHeight: "220px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    lineHeight: "1.4",
                    color: "var(--text-secondary)"
                  }}
                >
                  {JSON.parse(activeRunResult.timelineLog).map((t: any, idx: number) => {
                    let color = "var(--text-secondary)";
                    if (t.status === "success") color = "var(--color-brand)";
                    else if (t.status === "error") color = "var(--color-error)";
                    else if (t.status === "warning") color = "var(--color-warning)";

                    return (
                      <div key={idx} style={{ display: "flex", gap: "0.5rem" }}>
                        <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>[{t.time}]</span>
                        <span style={{ color }}>{t.event}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Active Threat Intelligence Feed Widget */}
          <div className="card" style={{ borderLeft: threats.some(t => t.status === "UNPATCHED") ? "4px solid var(--color-error)" : "4px solid var(--color-brand)" }}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="pulse-red" style={{ backgroundColor: threats.some(t => t.status === "UNPATCHED") ? "var(--color-error)" : "var(--color-brand)" }} />
                Active Threat Feed
              </span>
              <button 
                onClick={() => setShowThreatForm(!showThreatForm)} 
                className="btn btn-secondary" 
                style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", textTransform: "none" }}
              >
                {showThreatForm ? "Close Form" : "+ Ingest CVE"}
              </button>
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
              Live security alerts and newly discovered CVE vulnerabilities linked to the software stacks of registered ICT vendors.
            </p>

            {showThreatForm && (
              <form onSubmit={handleIngestThreat} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.25rem", padding: "0.75rem", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: "4px", border: "1px solid var(--border-color)" }}>
                <strong style={{ fontSize: "0.8rem", color: "var(--text-primary)" }}>Manual CVE Ingestion</strong>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.7rem" }}>Target Vendor</label>
                    <select
                      className="form-control"
                      value={ingestVendorId}
                      onChange={(e) => setIngestVendorId(e.target.value)}
                      style={{ padding: "0.3rem", fontSize: "0.75rem" }}
                    >
                      <option value="">-- Select Vendor --</option>
                      {Array.from(new Map(services.map(s => [s.vendor.id, s.vendor.legalName])).entries()).map(([vId, vName]) => (
                        <option key={vId} value={vId}>{vName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.7rem" }}>CVE ID</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="CVE-2026-XXXX"
                      value={ingestCveId}
                      onChange={(e) => setIngestCveId(e.target.value)}
                      style={{ padding: "0.3rem", fontSize: "0.75rem" }}
                      required
                    />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: "0.7rem" }}>Vulnerability Description</label>
                  <textarea
                    className="form-control"
                    placeholder="Describe the CVE vulnerability and affected package version..."
                    value={ingestDesc}
                    onChange={(e) => setIngestDesc(e.target.value)}
                    style={{ height: "50px", padding: "0.3rem", fontSize: "0.75rem" }}
                    required
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.7rem" }}>Severity</label>
                    <select
                      className="form-control"
                      value={ingestSeverity}
                      onChange={(e) => setIngestSeverity(e.target.value)}
                      style={{ padding: "0.3rem", fontSize: "0.75rem" }}
                    >
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="LOW">LOW</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.7rem" }}>Patch Status</label>
                    <select
                      className="form-control"
                      value={ingestStatus}
                      onChange={(e) => setIngestStatus(e.target.value)}
                      style={{ padding: "0.3rem", fontSize: "0.75rem" }}
                    >
                      <option value="UNPATCHED">UNPATCHED</option>
                      <option value="PATCHED">PATCHED</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: "0.35rem", fontSize: "0.75rem" }} disabled={ingestSaving}>
                  {ingestSaving ? "Saving..." : "Submit Threat Report"}
                </button>
              </form>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {threats.map((threat) => (
                <div
                  key={threat.id}
                  style={{
                    padding: "0.8rem",
                    borderRadius: "6px",
                    backgroundColor: "rgba(22, 28, 41, 0.15)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", fontFamily: "monospace" }}>
                      {threat.cveId}
                    </span>
                    <span className={`badge ${threat.status === "UNPATCHED" ? "danger" : "success"}`} style={{ fontSize: "0.6rem" }}>
                      {threat.status}
                    </span>
                  </div>
                  <strong style={{ fontSize: "0.75rem", color: "var(--color-brand)", display: "block", marginBottom: "0.2rem" }}>
                    {threat.vendor.legalName} Tech Stack
                  </strong>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: 0, lineHeight: "1.3" }}>
                    {threat.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* SBOM Technical Stack Scanner */}
          <div className="card" style={{ borderTop: "2px solid var(--color-warning)" }}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>SBOM Technical Stack Scanner</h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
              Paste a vendor's <code style={{ color: "var(--color-brand)" }}>package.json</code> file below to audit third-party dependency vulnerabilities.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <textarea
                  className="form-control"
                  style={{ minHeight: "120px", fontFamily: "monospace", fontSize: "0.75rem", backgroundColor: "rgba(0,0,0,0.2)" }}
                  placeholder={`{\n  "dependencies": {\n    "openssl": "^1.1.1",\n    "ecdsa-sig": "1.0.0"\n  }\n}`}
                  value={sbomInput}
                  onChange={(e) => setSbomInput(e.target.value)}
                />
              </div>

              {sbomErrors && (
                <div style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: "var(--color-error)", backgroundColor: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "4px" }}>
                  {sbomErrors}
                </div>
              )}

              <button
                className="btn btn-primary"
                onClick={handleRunSbomScan}
                disabled={!sbomInput}
              >
                🔍 Analyze Tech Stack Dependencies
              </button>

              {sbomScanRan && (
                <div style={{ marginTop: "0.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "1rem" }}>
                  <h3 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                    Audit Results ({sbomScanResults.length} Vulnerabilities)
                  </h3>

                  {sbomScanResults.length === 0 ? (
                    <div style={{ fontSize: "0.8rem", color: "var(--color-brand)", backgroundColor: "rgba(20, 184, 166, 0.05)", padding: "0.75rem", borderRadius: "4px", border: "1px solid rgba(20, 184, 166, 0.15)" }}>
                      ✓ Clean Scan! No vulnerable dependencies matched the active threat database.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {sbomScanResults.map((result, idx) => {
                        const isCreated = createdTasks[result.threat.id + "-" + result.depName];
                        return (
                          <div
                            key={idx}
                            style={{
                              padding: "0.75rem",
                              borderRadius: "6px",
                              backgroundColor: "rgba(239, 68, 68, 0.03)",
                              border: "1px solid rgba(239, 68, 68, 0.15)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.4rem"
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--color-error)" }}>
                                {result.threat.cveId} ({result.threat.severity})
                              </span>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Match: <code style={{ color: "var(--text-secondary)" }}>{result.depName}</code>
                              </span>
                            </div>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: 0, lineHeight: "1.3" }}>
                              {result.threat.description}
                            </p>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem", borderTop: "1px dashed rgba(255,255,255,0.06)", paddingTop: "0.4rem" }}>
                              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                Vendor: <strong>{result.threat.vendor.legalName}</strong>
                              </span>
                              <button
                                className="btn btn-secondary"
                                onClick={() => handleCreateSbomRemediation(result)}
                                disabled={isCreated}
                                style={{ padding: "0.2rem 0.5rem", fontSize: "0.65rem", textTransform: "none" }}
                              >
                                {isCreated ? "✓ Task Logged" : "Log Remediation Gap"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Pulsing Dot style */}
      <style jsx global>{`
        .pulse-red {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% {
            transform: scale(0.9);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
          }
          70% {
            transform: scale(1.1);
            box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
          }
          100% {
            transform: scale(0.9);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
          }
        }
      `}</style>
    </div>
  );
}
