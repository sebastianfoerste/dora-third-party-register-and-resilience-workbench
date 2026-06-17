import type { ReadinessStatus } from "./workflow-readiness";

export type RemediationSeverity = "HIGH" | "MEDIUM" | "LOW";
export type RemediationTaskStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export interface RemediationQueueTask {
  id: string;
  title: string;
  severity: RemediationSeverity;
  status: RemediationTaskStatus;
  owner?: string | null;
  dueDate?: string | Date | null;
  resolutionEvidence?: string | null;
}

export interface RemediationQueueSummary {
  status: ReadinessStatus;
  openCount: number;
  highOpenCount: number;
  overdueCount: number;
  unassignedCount: number;
  resolvedMissingEvidenceCount: number;
  blockers: string[];
  warnings: string[];
  nextActions: string[];
}

function isOverdue(task: RemediationQueueTask, now: Date): boolean {
  if (!task.dueDate || task.status === "RESOLVED") {
    return false;
  }
  return new Date(task.dueDate).getTime() < now.getTime();
}

export function summarizeRemediationQueue(
  tasks: RemediationQueueTask[],
  now: Date = new Date()
): RemediationQueueSummary {
  const openTasks = tasks.filter((task) => task.status !== "RESOLVED");
  const highOpenCount = openTasks.filter((task) => task.severity === "HIGH").length;
  const overdueCount = tasks.filter((task) => isOverdue(task, now)).length;
  const unassignedCount = openTasks.filter((task) => !task.owner?.trim()).length;
  const resolvedMissingEvidenceCount = tasks.filter(
    (task) => task.status === "RESOLVED" && !task.resolutionEvidence?.trim()
  ).length;

  const blockers: string[] = [];
  const warnings: string[] = [];
  const nextActions: string[] = [];

  if (highOpenCount > 0) {
    blockers.push("high-severity-remediation-open");
    nextActions.push("Assign a reviewer and target date for every high-severity gap.");
  }

  if (overdueCount > 0) {
    blockers.push("remediation-overdue");
    nextActions.push("Escalate overdue remediation to the accountable control owner.");
  }

  if (unassignedCount > 0) {
    warnings.push("remediation-owner-missing");
    nextActions.push("Add an owner before the next management export.");
  }

  if (resolvedMissingEvidenceCount > 0) {
    warnings.push("resolution-evidence-missing");
    nextActions.push("Attach closure evidence to resolved remediation tasks.");
  }

  return {
    status: blockers.length > 0 ? "BLOCKED" : warnings.length > 0 ? "REVIEW_REQUIRED" : "READY",
    openCount: openTasks.length,
    highOpenCount,
    overdueCount,
    unassignedCount,
    resolvedMissingEvidenceCount,
    blockers,
    warnings,
    nextActions,
  };
}

export const fixtureRemediationTasks: RemediationQueueTask[] = [
  {
    id: "rem_critical_exit",
    title: "Missing exit clause for critical ICT service",
    severity: "HIGH",
    status: "OPEN",
    owner: "ict-risk@example.test",
    dueDate: "2026-06-01",
  },
  {
    id: "rem_notice_period",
    title: "Notice period does not match internal control standard",
    severity: "MEDIUM",
    status: "IN_PROGRESS",
    owner: null,
    dueDate: "2026-07-15",
  },
  {
    id: "rem_audit_right",
    title: "Audit right evidence added to reviewed contract",
    severity: "HIGH",
    status: "RESOLVED",
    owner: "legal@example.test",
    dueDate: "2026-05-20",
    resolutionEvidence: "Synthetic signed addendum reference ADD-001.",
  },
];
