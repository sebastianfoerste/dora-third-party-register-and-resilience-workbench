import { describe, expect, it } from "vitest";

import {
  assessCriticalityReview,
  assessDoraExportReadiness,
  assessExitPlanReadiness,
  assessRemediationTask,
} from "../workflow-readiness";

describe("DORA workflow readiness", () => {
  it("blocks critical services until criticality review has evidence and approval", () => {
    expect(
      assessCriticalityReview({
        criticality: "CRITICAL",
        reviewStatus: "PENDING",
        reviewer: null,
        evidence: "",
      }),
    ).toEqual({
      status: "BLOCKED",
      blockers: ["criticality-review-not-approved", "criticality-evidence-missing"],
      warnings: [],
    });
  });

  it("treats approved criticality without reviewer attribution as review-required", () => {
    expect(
      assessCriticalityReview({
        criticality: "IMPORTANT",
        reviewStatus: "APPROVED",
        evidence: "Management body impact memo reviewed.",
      }),
    ).toEqual({
      status: "REVIEW_REQUIRED",
      blockers: [],
      warnings: ["criticality-reviewer-missing"],
    });
  });

  it("requires approved exit planning for critical or important services", () => {
    expect(
      assessExitPlanReadiness({
        criticality: "CRITICAL",
        exitPlanStatus: "DRAFT",
        reviewer: "Risk Committee",
      }),
    ).toEqual({
      status: "BLOCKED",
      blockers: ["exit-plan-not-approved"],
      warnings: ["exit-plan-test-evidence-missing", "exit-plan-alternative-missing"],
    });
  });

  it("flags overdue open remediation as an export blocker", () => {
    const assessment = assessRemediationTask({
      status: "OPEN",
      owner: "ict-risk@example.com",
      dueDate: "2026-01-15",
      now: new Date("2026-06-04T00:00:00.000Z"),
    });

    expect(assessment.status).toBe("BLOCKED");
    expect(assessment.blockers).toEqual(["remediation-open", "remediation-overdue"]);
  });

  it("summarises register export readiness across review, clauses, remediation, exit plans, and resilience", () => {
    expect(
      assessDoraExportReadiness({
        registerValidationStatus: "INVALID",
        criticalityReviewStatus: "PENDING",
        missingHighClauseCount: 2,
        openRemediationCount: 1,
        exitPlanStatus: "UNDER_REVIEW",
        latestResilienceTestStatus: "FAILED",
      }),
    ).toEqual({
      status: "BLOCKED",
      blockers: [
        "register-validation-invalid",
        "criticality-review-open",
        "high-severity-clause-gaps",
        "open-remediation",
        "exit-plan-open",
        "resilience-test-failed",
      ],
      warnings: [],
    });
  });
});
