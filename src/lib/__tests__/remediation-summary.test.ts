import { describe, expect, it } from "vitest";

import {
  fixtureRemediationTasks,
  summarizeRemediationQueue,
} from "../remediation-summary";

describe("summarizeRemediationQueue", () => {
  it("blocks management export when high-severity remediation is open or overdue", () => {
    const summary = summarizeRemediationQueue(
      fixtureRemediationTasks,
      new Date("2026-06-12T00:00:00.000Z")
    );

    expect(summary.status).toBe("BLOCKED");
    expect(summary.openCount).toBe(2);
    expect(summary.highOpenCount).toBe(1);
    expect(summary.overdueCount).toBe(1);
    expect(summary.blockers).toEqual([
      "high-severity-remediation-open",
      "remediation-overdue",
    ]);
    expect(summary.warnings).toEqual(["remediation-owner-missing"]);
    expect(summary.nextActions).toContain(
      "Assign a reviewer and target date for every high-severity gap."
    );
  });

  it("requires review when resolved tasks lack closure evidence", () => {
    const summary = summarizeRemediationQueue([
      {
        id: "rem_done",
        title: "Completed task without evidence",
        severity: "LOW",
        status: "RESOLVED",
        owner: "risk@example.test",
        dueDate: "2026-06-01",
        resolutionEvidence: "",
      },
    ]);

    expect(summary.status).toBe("REVIEW_REQUIRED");
    expect(summary.blockers).toEqual([]);
    expect(summary.warnings).toEqual(["resolution-evidence-missing"]);
    expect(summary.resolvedMissingEvidenceCount).toBe(1);
  });

  it("returns ready when all tasks are assigned and closed with evidence", () => {
    const summary = summarizeRemediationQueue([
      {
        id: "rem_done",
        title: "Completed task with evidence",
        severity: "MEDIUM",
        status: "RESOLVED",
        owner: "risk@example.test",
        dueDate: "2026-06-01",
        resolutionEvidence: "Synthetic closure evidence.",
      },
    ]);

    expect(summary.status).toBe("READY");
    expect(summary.nextActions).toEqual([]);
  });
});
