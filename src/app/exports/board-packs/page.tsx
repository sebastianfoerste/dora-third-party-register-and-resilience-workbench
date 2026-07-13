import Link from "next/link";

import {
  buildBoardPackCommandCenterRows,
  summarizeBoardPackCommandCenter,
} from "@/lib/board-pack-command-center";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export default async function BoardPackCommandCenterPage() {
  const entries = await prisma.registerEntry.findMany({
    include: {
      vendor: true,
      service: {
        include: {
          exitPlan: true,
          exitPlanRehearsals: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          criticalityAssessments: true,
        },
      },
      contract: {
        include: {
          clauseFindings: {
            include: {
              requirement: true,
              remediationTasks: true,
            },
          },
        },
      },
    },
  });
  const rows = buildBoardPackCommandCenterRows(entries);
  const summary = summarizeBoardPackCommandCenter(rows);
  const topBlocker = rows.find((row) => row.status === "BLOCKED") ?? rows.find((row) => row.status === "REVIEW_REQUIRED");

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <h1 className="page-title">Board Pack Command Center</h1>
          <p className="page-subtitle">
            Management export readiness across register entries, blockers, evidence gaps, exit plans, rehearsals, and remediation.
          </p>
        </div>
        <Link href="/exports" className="btn btn-secondary">
          Back to Export Center
        </Link>
      </div>

      <section className="card" style={{ padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
              Top next action
            </div>
            <h2 style={{ fontSize: "1.05rem", color: "var(--text-primary)", marginTop: "0.25rem" }}>
              {topBlocker ? `${topBlocker.providerName}: ${topBlocker.serviceName}` : "No board-pack blockers"}
            </h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
              {topBlocker
                ? `${topBlocker.blockerCount} blockers, ${topBlocker.evidenceGapCount} evidence gaps, ${topBlocker.warningCount} warnings.`
                : "All current rows are ready or there are no register entries yet."}
            </p>
          </div>
          {topBlocker && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Link href={topBlocker.reviewHref} className="btn btn-primary">
                Review item
              </Link>
              <Link href={topBlocker.packetHref} className="btn btn-secondary">
                Packet JSON
              </Link>
              <Link href={topBlocker.manifestHref} className="btn btn-secondary">
                Manifest JSON
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="card" style={{ padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
              Exit plan rehearsal command center
            </div>
            <h2 style={{ fontSize: "1.05rem", color: "var(--text-primary)", marginTop: "0.25rem" }}>
              {summary.rehearsalBlockingRows} board-pack row{summary.rehearsalBlockingRows === 1 ? "" : "s"} blocked by rehearsal evidence
            </h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
              Critical services require an approved rehearsal before the board pack can be marked ready.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(8rem, 1fr))", gap: "0.75rem", minWidth: "min(100%, 42rem)" }}>
            <Metric label="Rows" value={summary.totalRows} />
            <Metric label="Critical or important" value={summary.criticalOrImportantRows} />
            <Metric label="Missing approval" value={summary.rehearsalMissingOrNotApprovedRows} />
            <Metric label="Failed rehearsal" value={summary.rehearsalFailedRows} />
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "980px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                <th style={{ textAlign: "left", padding: "0.8rem 1rem" }}>Provider</th>
                <th style={{ textAlign: "left", padding: "0.8rem 1rem" }}>Status</th>
                <th style={{ textAlign: "left", padding: "0.8rem 1rem" }}>Readiness</th>
                <th style={{ textAlign: "left", padding: "0.8rem 1rem" }}>Operational lanes</th>
                <th style={{ textAlign: "left", padding: "0.8rem 1rem" }}>Digest</th>
                <th style={{ textAlign: "left", padding: "0.8rem 1rem" }}>Downloads</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.registerEntryId} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "0.9rem 1rem", verticalAlign: "top" }}>
                    <strong style={{ color: "var(--text-primary)" }}>{row.providerName}</strong>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{row.serviceName}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>{row.criticality}</div>
                  </td>
                  <td style={{ padding: "0.9rem 1rem", verticalAlign: "top" }}>
                    <span className={`badge ${row.status === "READY" ? "success" : row.status === "REVIEW_REQUIRED" ? "warning" : "danger"}`}>
                      {row.status}
                    </span>
                  </td>
                  <td style={{ padding: "0.9rem 1rem", verticalAlign: "top", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    <div>Blockers: {row.blockerCount}</div>
                    <div>Evidence gaps: {row.evidenceGapCount}</div>
                    <div>Exit plan: {row.exitPlanStatus ?? "MISSING"}</div>
                    <div>Rehearsal: {row.rehearsalStatus ?? "MISSING"}</div>
                    <div>Rehearsal gate: {row.rehearsalBlockingBoardPack ? "BLOCKING" : "CLEAR"}</div>
                    <div>Action: {row.rehearsalAction}</div>
                    {row.rehearsalDigest ? <div>Rehearsal digest: {row.rehearsalDigest.slice(0, 12)}</div> : null}
                    <div>Remediation: {row.remediationStatus}</div>
                  </td>
                  <td style={{ padding: "0.9rem 1rem", verticalAlign: "top" }}>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      {row.blockerLinks.length > 0 ? (
                        row.blockerLinks.map((link) => (
                          <Link key={`${row.registerEntryId}:${link.label}:${link.href}`} href={link.href} className="btn btn-secondary" style={{ fontSize: "0.72rem", padding: "0.25rem 0.45rem" }}>
                            {link.label}
                          </Link>
                        ))
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>No blocker lane</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "0.9rem 1rem", verticalAlign: "top" }}>
                    <code style={{ color: "var(--color-brand)", fontSize: "0.72rem" }}>{row.packetDigest.slice(0, 16)}</code>
                  </td>
                  <td style={{ padding: "0.9rem 1rem", verticalAlign: "top" }}>
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                      <Link href={row.packetHref} className="btn btn-secondary" style={{ fontSize: "0.72rem", padding: "0.25rem 0.45rem" }}>
                        Packet
                      </Link>
                      <Link href={row.manifestHref} className="btn btn-secondary" style={{ fontSize: "0.72rem", padding: "0.25rem 0.45rem" }}>
                        Manifest
                      </Link>
                      <Link href={row.reviewHref} className="btn btn-primary" style={{ fontSize: "0.72rem", padding: "0.25rem 0.45rem" }}>
                        Review
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "2rem", color: "var(--text-muted)", textAlign: "center" }}>
                    No register entries available for board-pack readiness.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid var(--border-color)", borderRadius: "0.5rem", padding: "0.75rem" }}>
      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ marginTop: "0.25rem", fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}
