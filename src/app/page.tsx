import { prisma } from "@/lib/prisma";
import { validateRegisterEntry } from "@/lib/validators";
import Link from "next/link";

export const revalidate = 0; // Disable caching to ensure data is always fresh

export default async function DashboardPage() {
  // Load data from DB
  const entries = await prisma.registerEntry.findMany({
    include: {
      legalEntity: true,
      vendor: true,
      service: {
        include: {
          criticalityAssessments: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      contract: {
        include: {
          clauseFindings: {
            include: { requirement: true },
          },
        },
      },
    },
  });

  const vendors = await prisma.vendor.findMany();
  const openTasks = await prisma.remediationTask.findMany({
    where: { status: "OPEN" },
  });

  // Calculate live validation scores for all register entries
  let totalScore = 0;
  let criticalCount = 0;
  let totalGaps = 0;
  const serviceSummaries = [];

  for (const entry of entries) {
    const findingsMapped = entry.contract
      ? entry.contract.clauseFindings.map((f) => ({
          requirementId: f.requirementId,
          requirementName: f.requirement.requirementName,
          status: f.status,
          severity: f.requirement.severity,
        }))
      : [];

    const valResult = validateRegisterEntry({
      legalEntity: entry.legalEntity,
      vendor: entry.vendor,
      service: entry.service,
      contract: entry.contract,
      findings: findingsMapped,
      criticality: entry.criticality as any,
    });

    totalScore += valResult.score;
    if (entry.criticality === "CRITICAL" || entry.criticality === "IMPORTANT") {
      criticalCount++;
    }

    // Count missing clauses
    const missingCount = findingsMapped.filter((f) => f.status === "MISSING").length;
    totalGaps += missingCount;

    serviceSummaries.push({
      id: entry.service.id,
      vendorName: entry.vendor.legalName,
      supportedFunction: entry.service.supportedFunction,
      criticality: entry.criticality,
      score: valResult.score,
      status: valResult.status,
      errorsCount: valResult.errors.length,
    });
  }

  const averageCompleteness = entries.length > 0 ? Math.round(totalScore / entries.length) : 0;

  // Concentration data
  const countries: Record<string, number> = {};
  vendors.forEach((v) => {
    countries[v.country] = (countries[v.country] || 0) + 1;
  });

  // Load pending items for action feed
  const pendingAssessments = await prisma.criticalityAssessment.findMany({
    where: { status: "PENDING" },
    include: { service: { include: { vendor: true } } },
    take: 5,
  });

  const contractsWithoutFindings = await prisma.contract.findMany({
    where: {
      clauseFindings: { none: {} },
    },
    include: { vendor: true },
    take: 5,
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Operational Resilience Cockpit</h1>
        <p className="page-subtitle">CASP & EMI Digital Operational Resilience Act (DORA) Compliance Summary</p>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="card metric-card">
          <span className="metric-title">Register Completeness</span>
          <div className="metric-value-row">
            <span className="metric-value" style={{ color: averageCompleteness > 80 ? "var(--color-brand)" : averageCompleteness > 50 ? "var(--color-warning)" : "var(--color-error)" }}>
              {averageCompleteness}%
            </span>
            <span className={`metric-badge ${averageCompleteness > 80 ? "success" : averageCompleteness > 50 ? "warning" : "error"}`}>
              {averageCompleteness > 80 ? "Supervised Ready" : "Review Required"}
            </span>
          </div>
        </div>

        <div className="card metric-card">
          <span className="metric-title">Active ICT Vendors</span>
          <div className="metric-value-row">
            <span className="metric-value">{vendors.length}</span>
            <span className="text-secondary" style={{ fontSize: "0.85rem" }}>
              EU wedged concentration
            </span>
          </div>
        </div>

        <div className="card metric-card">
          <span className="metric-title">Critical & Important Services</span>
          <div className="metric-value-row">
            <span className="metric-value" style={{ color: "var(--color-warning)" }}>{criticalCount}</span>
            <span className="metric-badge warning">Enhanced Audit Rules</span>
          </div>
        </div>

        <div className="card metric-card">
          <span className="metric-title">Open Remediation Gaps</span>
          <div className="metric-value-row">
            <span className="metric-value" style={{ color: openTasks.length > 0 ? "var(--color-error)" : "var(--color-brand)" }}>
              {openTasks.length}
            </span>
            <span className={`metric-badge ${openTasks.length > 0 ? "error" : "success"}`}>
              {openTasks.length > 0 ? "Action Required" : "Gaps Resolved"}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
        {/* Left Column: Critical Services status */}
        <div className="card">
          <h2 style={{ fontSize: "1.25rem", marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Critical & Important ICT Services</span>
            <Link href="/register" style={{ fontSize: "0.85rem", color: "var(--color-brand)", textDecoration: "none" }}>View Register</Link>
          </h2>
          <div className="table-container" style={{ border: "none", background: "none", marginBottom: 0 }}>
            <table className="dense-table">
              <thead>
                <tr>
                  <th>Service / Function</th>
                  <th>Vendor</th>
                  <th>Criticality</th>
                  <th>Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {serviceSummaries.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{s.supportedFunction}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>Scope of register</div>
                    </td>
                    <td>{s.vendorName}</td>
                    <td>
                      <span className={`badge ${s.criticality === "CRITICAL" ? "critical" : s.criticality === "IMPORTANT" ? "important" : "non-critical"}`}>
                        {s.criticality}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{ flex: 1, width: "60px", height: "4px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                          <div style={{ width: `${s.score}%`, height: "100%", backgroundColor: s.score > 80 ? "var(--color-brand)" : s.score > 50 ? "var(--color-warning)" : "var(--color-error)" }} />
                        </div>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>{s.score}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${s.status === "VALID" ? "success" : s.status === "WARNING" ? "warning" : "danger"}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {serviceSummaries.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                      No register rows found. Please upload a DORA register or seed the database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Concentration & Action Feed */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Vendor concentration card */}
          <div className="card">
            <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Concentration Risk (Country)</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {Object.entries(countries).map(([country, count]) => {
                const pct = Math.round((count / vendors.length) * 100) || 0;
                const isEU = country !== "US" && country !== "GB" && country !== "IL";
                return (
                  <div key={country} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                      <span style={{ fontWeight: 500 }}>
                        {country === "DE" ? "Germany (Wedge DE)" : country === "LU" ? "Luxembourg (LU)" : country === "IL" ? "Israel (IL)" : country === "GB" ? "United Kingdom (GB)" : country}
                        {!isEU && <span style={{ color: "var(--color-error)", fontSize: "0.75rem", marginLeft: "0.5rem" }}>(Non-EU Mapped)</span>}
                      </span>
                      <span style={{ fontWeight: 600 }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ width: "100%", height: "6px", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", backgroundColor: isEU ? "var(--color-brand)" : "var(--color-error)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action feed */}
          <div className="card" style={{ flex: 1 }}>
            <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Compliance Action Feed</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {pendingAssessments.map((a) => (
                <div key={a.id} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", fontSize: "0.85rem" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--color-warning)", marginTop: "0.35rem" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>Review Criticality Classification</div>
                    <div style={{ color: "var(--text-muted)", marginTop: "0.15rem" }}>
                      AI suggested <span style={{ color: "var(--color-warning)", fontWeight: 600 }}>{a.result}</span> for {a.service.vendor.legalName} service supporting '{a.service.supportedFunction}'
                    </div>
                    <Link href={`/vendors/${a.service.vendorId}`} style={{ color: "var(--color-brand)", textDecoration: "none", fontSize: "0.75rem", display: "inline-block", marginTop: "0.25rem" }}>Review vendor profile &rarr;</Link>
                  </div>
                </div>
              ))}

              {contractsWithoutFindings.map((c) => (
                <div key={c.id} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", fontSize: "0.85rem" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--color-error)", marginTop: "0.35rem" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>Contract Clause Gap Audit Needed</div>
                    <div style={{ color: "var(--text-muted)", marginTop: "0.15rem" }}>
                      {c.sourceFile} (Vendor: {c.vendor.legalName}) is uploaded but DORA requirements check has not been run.
                    </div>
                    <Link href={`/contracts/${c.id}`} style={{ color: "var(--color-brand)", textDecoration: "none", fontSize: "0.75rem", display: "inline-block", marginTop: "0.25rem" }}>Run Clause Review &rarr;</Link>
                  </div>
                </div>
              ))}

              {pendingAssessments.length === 0 && contractsWithoutFindings.length === 0 && (
                <div style={{ textAlign: "center", padding: "1rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  ✓ All uploaded contracts audited. All classifications reviewed. Zero urgent compliance activities.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
