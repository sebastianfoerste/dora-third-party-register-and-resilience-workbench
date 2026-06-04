export type Criticality = "CRITICAL" | "IMPORTANT" | "NON_CRITICAL";
export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export type RemediationStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";
export type ReadinessStatus = "READY" | "REVIEW_REQUIRED" | "BLOCKED";

export interface ReadinessAssessment {
  status: ReadinessStatus;
  blockers: string[];
  warnings: string[];
}

export function assessCriticalityReview(input: {
  criticality: Criticality;
  reviewStatus: ReviewStatus;
  reviewer?: string | null;
  evidence?: string | null;
}): ReadinessAssessment {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (input.reviewStatus === "REJECTED") {
    blockers.push("criticality-review-rejected");
  }

  if (input.reviewStatus !== "APPROVED") {
    blockers.push("criticality-review-not-approved");
  }

  if (input.criticality !== "NON_CRITICAL" && !input.evidence?.trim()) {
    blockers.push("criticality-evidence-missing");
  }

  if (input.reviewStatus === "APPROVED" && !input.reviewer?.trim()) {
    warnings.push("criticality-reviewer-missing");
  }

  return {
    status: blockers.length > 0 ? "BLOCKED" : warnings.length > 0 ? "REVIEW_REQUIRED" : "READY",
    blockers,
    warnings,
  };
}

export function assessExitPlanReadiness(input: {
  criticality: Criticality;
  exitPlanStatus?: string | null;
  reviewer?: string | null;
  testedDate?: Date | string | null;
  alternativeVendor?: string | null;
}): ReadinessAssessment {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const isCriticalOrImportant = input.criticality === "CRITICAL" || input.criticality === "IMPORTANT";

  if (!isCriticalOrImportant) {
    return { status: "READY", blockers, warnings };
  }

  if (!input.exitPlanStatus || input.exitPlanStatus === "NONE") {
    blockers.push("exit-plan-missing");
  } else if (input.exitPlanStatus !== "APPROVED") {
    blockers.push("exit-plan-not-approved");
  }

  if (!input.reviewer?.trim()) {
    warnings.push("exit-plan-reviewer-missing");
  }

  if (!input.testedDate) {
    warnings.push("exit-plan-test-evidence-missing");
  }

  if (!input.alternativeVendor?.trim()) {
    warnings.push("exit-plan-alternative-missing");
  }

  return {
    status: blockers.length > 0 ? "BLOCKED" : warnings.length > 0 ? "REVIEW_REQUIRED" : "READY",
    blockers,
    warnings,
  };
}

export function assessRemediationTask(input: {
  status: RemediationStatus;
  owner?: string | null;
  dueDate?: Date | string | null;
  resolutionEvidence?: string | null;
  now?: Date;
}): ReadinessAssessment {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const now = input.now ?? new Date();

  if (!input.owner?.trim()) {
    warnings.push("remediation-owner-missing");
  }

  if (input.status !== "RESOLVED") {
    blockers.push("remediation-open");
  }

  if (input.dueDate && new Date(input.dueDate).getTime() < now.getTime() && input.status !== "RESOLVED") {
    blockers.push("remediation-overdue");
  }

  if (input.status === "RESOLVED" && !input.resolutionEvidence?.trim()) {
    warnings.push("resolution-evidence-missing");
  }

  return {
    status: blockers.length > 0 ? "BLOCKED" : warnings.length > 0 ? "REVIEW_REQUIRED" : "READY",
    blockers,
    warnings,
  };
}

export function assessDoraExportReadiness(input: {
  registerValidationStatus: "VALID" | "WARNING" | "INVALID";
  criticalityReviewStatus: ReviewStatus;
  missingHighClauseCount: number;
  openRemediationCount: number;
  exitPlanStatus?: string | null;
  latestResilienceTestStatus?: "PASSED" | "FAILED" | "PENDING" | null;
}): ReadinessAssessment {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (input.registerValidationStatus === "INVALID") {
    blockers.push("register-validation-invalid");
  } else if (input.registerValidationStatus === "WARNING") {
    warnings.push("register-validation-warning");
  }

  if (input.criticalityReviewStatus !== "APPROVED") {
    blockers.push("criticality-review-open");
  }

  if (input.missingHighClauseCount > 0) {
    blockers.push("high-severity-clause-gaps");
  }

  if (input.openRemediationCount > 0) {
    blockers.push("open-remediation");
  }

  if (input.exitPlanStatus && input.exitPlanStatus !== "APPROVED") {
    blockers.push("exit-plan-open");
  }

  if (input.latestResilienceTestStatus === "FAILED") {
    blockers.push("resilience-test-failed");
  } else if (input.latestResilienceTestStatus === "PENDING" || !input.latestResilienceTestStatus) {
    warnings.push("resilience-test-not-current");
  }

  return {
    status: blockers.length > 0 ? "BLOCKED" : warnings.length > 0 ? "REVIEW_REQUIRED" : "READY",
    blockers,
    warnings,
  };
}
