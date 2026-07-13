import { buildDemoContractIntelligenceWorkspace } from "@/lib/contract-intelligence";
import { loadPersistedLegoraWorkspace } from "@/lib/legora-persistence";

import { WorkspaceClient } from "./workspace-client";

export const dynamic = "force-dynamic";

const statusColor = {
  pass: "#34d399",
  review: "#fbbf24",
  missing: "#fb7185",
};

export default async function ContractIntelligencePage() {
  const { vault, reviewTable, workflow } = buildDemoContractIntelligenceWorkspace();
  const legora = await loadPersistedLegoraWorkspace();

  return (
    <div style={{ padding: "2rem", display: "grid", gap: "1.5rem" }}>
      <header>
        <p style={{ color: "var(--color-brand)", fontWeight: 700, marginBottom: "0.4rem" }}>
          Contract Intelligence
        </p>
        <h1 style={{ margin: 0 }}>DORA contract review workspace</h1>
        <p style={{ maxWidth: "760px", color: "var(--text-muted)" }}>
          A synthetic, internal-review workspace combining a contract vault, portfolio clause review table and guided remediation workflow. External delivery remains disabled.
        </p>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "1rem" }}>
        {[
          ["Vault documents", vault.documentCount],
          ["Vendors", vault.vendorCount],
          ["Review blockers", reviewTable.blockerCount],
          ["Workflow state", workflow.status.replaceAll("_", " ")],
        ].map(([label, value]) => (
          <article key={String(label)} className="card" style={{ padding: "1rem" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>{label}</div>
            <strong style={{ display: "block", marginTop: "0.4rem", fontSize: "1.2rem" }}>{value}</strong>
          </article>
        ))}
      </section>

      <section className="card" style={{ padding: "1.25rem", overflowX: "auto" }}>
        <h2 style={{ marginTop: 0 }}>Portfolio clause review table</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{reviewTable.instructions}</p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Document</th>
              {reviewTable.columns.map((column) => (
                <th key={column.id} style={{ textAlign: "left", padding: "0.75rem" }}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reviewTable.rows.map((row) => (
              <tr key={row.documentId} style={{ borderTop: "1px solid var(--border-color)" }}>
                <td style={{ padding: "0.75rem", verticalAlign: "top" }}>
                  <strong>{row.vendorName}</strong><br />
                  <span style={{ color: "var(--text-muted)" }}>{row.documentTitle}</span>
                </td>
                {row.cells.map((cell) => (
                  <td key={cell.columnId} style={{ padding: "0.75rem", verticalAlign: "top" }}>
                    <strong style={{ color: statusColor[cell.status] }}>{cell.status.toUpperCase()}</strong>
                    <div style={{ marginTop: "0.3rem" }}>{cell.value}</div>
                    <div style={{ marginTop: "0.3rem", color: "var(--text-muted)" }}>{cell.citation}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ padding: "1.25rem" }}>
        <h2 style={{ marginTop: 0 }}>Remediation workflow agent</h2>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {workflow.steps.map((step) => (
            <article key={step.id} style={{ border: "1px solid var(--border-color)", borderRadius: "8px", padding: "0.8rem" }}>
              <strong>{step.label}</strong>
              <span style={{ marginLeft: "0.6rem", color: step.status === "complete" ? "#34d399" : "#fbbf24" }}>
                {step.status.replaceAll("_", " ")}
              </span>
              <div style={{ color: "var(--text-muted)", marginTop: "0.25rem" }}>{step.blocker || `Owner: ${step.owner}`}</div>
            </article>
          ))}
        </div>
        <p style={{ marginBottom: 0 }}><strong>Next action:</strong> {workflow.nextAction}</p>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1rem" }}>
        {[
          ["Collaborative cells", legora.collaboration.cells.length, "Stable IDs, comments, reviewer decisions and optimistic locks"],
          ["Playbook change sets", legora.changeSets.length, "Versioned clause positions with accepted-only DOCX export"],
          ["Remediation List", legora.remediationList.items.length, "Evidence-gated tasks with owners, deadlines and dependencies"],
        ].map(([label, value, detail]) => (
          <article key={String(label)} className="card" style={{ padding: "1rem" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>{label}</div>
            <strong style={{ display: "block", marginTop: "0.4rem", fontSize: "1.4rem" }}>{value}</strong>
            <p style={{ color: "var(--text-muted)", marginBottom: 0 }}>{detail}</p>
          </article>
        ))}
      </section>
      <WorkspaceClient initial={legora} />
    </div>
  );
}
