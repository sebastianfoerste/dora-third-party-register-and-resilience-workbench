"use client";

import { useState } from "react";

type Workspace = Awaited<ReturnType<typeof import("@/lib/collaboration-persistence").loadPersistedCollaborationWorkspace>>;

export function WorkspaceClient({ initial }: { initial: Workspace }) {
  const [workspace, setWorkspace] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function mutate(payload: Record<string, unknown>) {
    const response = await fetch("/api/collaboration/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: "DORA legal reviewer", ...payload }),
    });
    const next = await response.json();
    if (!response.ok) {
      setError(next.error ?? "Review mutation failed");
      return;
    }
    setError(null);
    setWorkspace(next);
  }

  return (
    <section className="card" style={{ padding: "1.25rem" }}>
      <h2 style={{ marginTop: 0 }}>Persisted review queue</h2>
      <p style={{ color: "var(--text-muted)" }}>
        Every lock, assignment, decision, comment and resolution is written to SQLite with an optimistic revision check.
      </p>
      {error && <p role="alert" style={{ color: "var(--color-error)" }}>{error}</p>}
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {workspace.collaboration.cells.slice(0, 8).map((cell) => (
          <article key={cell.id} style={{ border: "1px solid var(--border-color)", borderRadius: 8, padding: "0.8rem" }}>
            <div><strong>{cell.requirementId}</strong> · revision {cell.revision} · {cell.decision}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.6rem" }}>
              <button onClick={() => mutate({ action: "lock", targetId: cell.id, expectedRevision: cell.revision })}>Lock</button>
              <button onClick={() => mutate({ action: "assign", targetId: cell.id, expectedRevision: cell.revision, value: "DORA legal reviewer" })}>Assign</button>
              <button onClick={() => mutate({ action: "decide", targetId: cell.id, expectedRevision: cell.revision, value: "accepted" })}>Accept</button>
              <button onClick={() => mutate({ action: "comment", targetId: cell.id, expectedRevision: cell.revision, value: "Source and playbook position checked." })}>Comment</button>
            </div>
          </article>
        ))}
      </div>
      {workspace.changeSets[0]?.changes[0] && (
        <div style={{ marginTop: "1rem" }}>
          <button onClick={() => mutate({ action: "decide_change", targetId: workspace.changeSets[0].id, expectedRevision: workspace.changeSets[0].revision, value: `${workspace.changeSets[0].changes[0].id}:accepted` })}>
            Accept first DOCX change
          </button>
        </div>
      )}
      {workspace.remediationList.items[0] && (
        <div style={{ marginTop: "0.75rem" }}>
          <button onClick={() => mutate({ action: "resolve_task", targetId: workspace.remediationList.items[0].id, evidenceRefs: ["fixture://evidence/reviewer-approved"] })}>
            Resolve first item with evidence
          </button>
        </div>
      )}
      <p style={{ marginBottom: 0, marginTop: "1rem", color: "var(--text-muted)" }}>
        {workspace.changeSets.length} persisted change sets. {workspace.remediationList.blocked} remediation items remain evidence-gated.
      </p>
    </section>
  );
}
