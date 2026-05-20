"use client";

import { useEffect, useState } from "react";

interface Service {
  id: string;
  supportedFunction: string;
  vendor: {
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

export default function ResiliencePage() {
  const [tests, setTests] = useState<ResilienceTest[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Form State
  const [serviceId, setServiceId] = useState("");
  const [testType, setTestType] = useState("VULNERABILITY_ASSESSMENT");
  const [testDate, setTestDate] = useState("");
  const [status, setStatus] = useState<"PASSED" | "FAILED" | "PENDING">("PASSED");
  const [findingsCount, setFindingsCount] = useState(0);
  const [evidenceSummary, setEvidenceSummary] = useState("");

  const loadData = async () => {
    try {
      const res = await fetch("/api/resilience");
      const data = await res.json();
      if (data.success) {
        setTests(data.tests);
        setServices(data.services);
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
            Log and review vulnerability scans, penetration tests, and disaster recovery drills. Fulfills DORA Article 24 resilience evidence tracking.
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
      
      {/* Pulsing Dot style */}
      <style jsx global>{`
        .pulse-red {
          width: 8px;
          height: 8px;
          background: var(--color-error);
          border-radius: 50%;
          box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          animation: pulse 1.5s infinite;
        }
      `}</style>
    </div>
  );
}
