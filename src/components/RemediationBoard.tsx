"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  summarizeRemediationQueue,
  type RemediationSeverity,
  type RemediationTaskStatus,
} from "@/lib/remediation-summary";

interface RemediationTaskItem {
  id: string;
  title: string;
  description: string;
  owner: string;
  dueDate: string | Date | null;
  severity: string;
  status: string;
  resolutionEvidence: string | null;
  finding: {
    contract: {
      id: string;
      sourceFile: string;
      vendor: { legalName: string };
    } | null;
    requirement: {
      regulatoryBasis: string;
      requirementName: string;
    };
  } | null;
}

interface Props {
  initialTasks: RemediationTaskItem[];
}

function normalizeSeverity(value: string): RemediationSeverity {
  return value === "HIGH" || value === "MEDIUM" || value === "LOW" ? value : "LOW";
}

function normalizeStatus(value: string): RemediationTaskStatus {
  return value === "OPEN" || value === "IN_PROGRESS" || value === "RESOLVED"
    ? value
    : "OPEN";
}

export default function RemediationBoard({ initialTasks }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<RemediationTaskItem[]>(initialTasks);
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("OPEN");

  // Form states
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState("");
  const [owner, setOwner] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const startResolve = (task: RemediationTaskItem) => {
    setResolvingId(task.id);
    setEvidence(task.resolutionEvidence || "");
    setOwner(task.owner || "");
  };

  const handleSubmitResolve = async (taskId: string) => {
    if (!evidence) {
      alert("Please provide resolution evidence/details.");
      return;
    }
    setSavingId(taskId);
    try {
      const response = await fetch(`/api/remediation/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "RESOLVED",
          resolutionEvidence: evidence,
          owner: owner || "Compliance Officer",
        }),
      });

      const res = await response.json();
      if (res.success) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, ...res.task } : t))
        );
        setResolvingId(null);
        router.refresh();
      } else {
        alert(res.error || "Failed to resolve task.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit resolution.");
    } finally {
      setSavingId(null);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesSeverity = filterSeverity === "ALL" || t.severity === filterSeverity;
    const matchesStatus = filterStatus === "ALL" || t.status === filterStatus;
    return matchesSeverity && matchesStatus;
  });

  const remediationSummary = useMemo(
    () =>
      summarizeRemediationQueue(
        tasks.map((task) => ({
          id: task.id,
          title: task.title,
          severity: normalizeSeverity(task.severity),
          status: normalizeStatus(task.status),
          owner: task.owner,
          dueDate: task.dueDate,
          resolutionEvidence: task.resolutionEvidence,
        }))
      ),
    [tasks]
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Remediation Tracker</h1>
        <p className="page-subtitle">Track and close contractual and compliance gaps mapping to DORA standards.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <div className="card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Queue Status</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: remediationSummary.status === "BLOCKED" ? "var(--color-error)" : remediationSummary.status === "REVIEW_REQUIRED" ? "var(--color-warning)" : "var(--color-brand)" }}>
            {remediationSummary.status}
          </div>
        </div>
        <div className="card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Open Gaps</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{remediationSummary.openCount}</div>
        </div>
        <div className="card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>High Severity Open</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{remediationSummary.highOpenCount}</div>
        </div>
        <div className="card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Overdue</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{remediationSummary.overdueCount}</div>
        </div>
      </div>

      {remediationSummary.nextActions[0] && (
        <div style={{ marginBottom: "1.5rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          <strong style={{ color: "var(--text-primary)" }}>Next action:</strong>{" "}
          {remediationSummary.nextActions[0]}
        </div>
      )}

      {/* Filter toolbar */}
      <div className="card" style={{ padding: "1.25rem", marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Gaps Status:</span>
            <select
              className="form-control"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: "160px", padding: "0.4rem 0.6rem" }}
            >
              <option value="ALL">All Gaps</option>
              <option value="OPEN">Open Gaps</option>
              <option value="RESOLVED">Resolved Gaps</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Gap Severity:</span>
            <select
              className="form-control"
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              style={{ width: "160px", padding: "0.4rem 0.6rem" }}
            >
              <option value="ALL">All Severities</option>
              <option value="HIGH">High Severity</option>
              <option value="MEDIUM">Medium Severity</option>
              <option value="LOW">Low Severity</option>
            </select>
          </div>

          <div style={{ flex: 1, textAlign: "right", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Showing <strong>{filteredTasks.length}</strong> gaps matching criteria
          </div>

        </div>
      </div>

      {/* Tasks listing */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {filteredTasks.map((t) => {
          const isResolving = resolvingId === t.id;
          const isSaving = savingId === t.id;

          return (
            <div
              key={t.id}
              className="card"
              style={{
                backgroundColor: "rgba(22, 28, 41, 0.4)",
                borderLeft: `4px solid ${
                  t.status === "RESOLVED"
                    ? "var(--color-brand)"
                    : t.severity === "HIGH"
                    ? "var(--color-error)"
                    : t.severity === "MEDIUM"
                    ? "var(--color-warning)"
                    : "var(--color-info)"
                }`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span className={`badge ${t.severity === "HIGH" ? "danger" : t.severity === "MEDIUM" ? "warning" : "non-critical"}`}>
                      {t.severity} Severity
                    </span>
                    <span className={`badge ${t.status === "RESOLVED" ? "success" : "warning"}`}>
                      {t.status}
                    </span>
                  </div>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)", marginTop: "0.4rem" }}>
                    {t.title}
                  </h3>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    Due Date: <strong>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "Unscheduled"}</strong>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                    Owner: {t.owner || "Unassigned"}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                {t.description}
              </p>

              {/* Source Contract Mapping info */}
              {t.finding?.contract ? (
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "0.75rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  <span><strong>Requirement:</strong> {t.finding.requirement.requirementName} ({t.finding.requirement.regulatoryBasis})</span>
                  <span>&middot;</span>
                  <span><strong>Vendor:</strong> {t.finding.contract.vendor.legalName}</span>
                  <span>&middot;</span>
                  <span>
                    <strong>Contract File:</strong>{" "}
                    <Link href={`/contracts/${t.finding.contract.id}`} style={{ color: "var(--color-brand)", textDecoration: "none" }}>
                      {t.finding.contract.sourceFile}
                    </Link>
                  </span>
                </div>
              ) : (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "0.75rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Standalone remediation task, no mapped contract finding.
                </div>
              )}

              {/* Resolution details if resolved */}
              {t.status === "RESOLVED" && t.resolutionEvidence && (
                <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", backgroundColor: "rgba(20, 184, 166, 0.04)", borderLeft: "2px solid var(--color-brand)", borderRadius: "2px", fontSize: "0.8rem" }}>
                  <strong style={{ color: "var(--color-brand)" }}>Resolution Details:</strong> {t.resolutionEvidence}
                </div>
              )}

              {/* Resolution form if actioning */}
              {t.status === "OPEN" && !isResolving && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
                  <button className="btn btn-secondary" onClick={() => startResolve(t)} style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}>
                    Log Gap Resolution
                  </button>
                </div>
              )}

              {isResolving && (
                <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.75rem" }}>Assigned Owner Email / ID</label>
                    <input
                      type="text"
                      className="form-control"
                      value={owner}
                      onChange={(e) => setOwner(e.target.value)}
                      placeholder="e.g. legal-counsel@casp-workbench.de"
                      style={{ padding: "0.4rem 0.6rem", fontSize: "0.85rem" }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.75rem" }}>Resolution Details & Compliance Evidence (Required)</label>
                    <textarea
                      className="form-control"
                      value={evidence}
                      onChange={(e) => setEvidence(e.target.value)}
                      placeholder="Specify what wording was added to the contract, when it was signed, or upload reference ID."
                      style={{ height: "80px", padding: "0.4rem 0.6rem", fontSize: "0.85rem" }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setResolvingId(null)}
                      disabled={isSaving}
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleSubmitResolve(t.id)}
                      disabled={isSaving}
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                    >
                      {isSaving ? "Saving..." : "Confirm Gap Resolution"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
            ✓ No remediation tasks match selected filters.
          </div>
        )}
      </div>
    </div>
  );
}
