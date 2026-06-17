import { describe, expect, it } from "vitest";

import {
  assessExitPlanRehearsalReadiness,
  buildExitPlanRehearsalCreateInput,
  summarizeLatestExitPlanRehearsal,
} from "../exit-plan-rehearsal";

describe("exit plan rehearsal ledger", () => {
  it("builds a stable persisted rehearsal input with deterministic JSON digests", () => {
    const first = buildExitPlanRehearsalCreateInput({
      serviceId: "svc-1",
      scenarioType: "provider_failure",
      assumptions: { b: 2, a: 1 },
      outcome: { status: "COMPLETED", timelineEventCount: 4 },
      survivabilityScore: 82,
      status: "COMPLETED",
      createdAt: "2026-06-16T09:00:00.000Z",
    });
    const second = buildExitPlanRehearsalCreateInput({
      serviceId: "svc-1",
      scenarioType: "provider_failure",
      assumptions: { a: 1, b: 2 },
      outcome: { timelineEventCount: 4, status: "COMPLETED" },
      survivabilityScore: 82,
      status: "COMPLETED",
      createdAt: "2026-06-16T09:00:00.000Z",
    });

    expect(first.assumptionsJson).toBe('{"a":1,"b":2}');
    expect(first.digest).toBe(second.digest);
    expect(first.digest).toHaveLength(64);
  });

  it("summarizes the latest rehearsal only", () => {
    const latest = summarizeLatestExitPlanRehearsal([
      {
        id: "old",
        serviceId: "svc-1",
        scenarioType: "old",
        assumptionsJson: "{}",
        outcomeJson: "{}",
        survivabilityScore: 75,
        status: "COMPLETED",
        digest: "old-digest",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "new",
        serviceId: "svc-1",
        scenarioType: "new",
        assumptionsJson: "{}",
        outcomeJson: "{}",
        survivabilityScore: 91,
        status: "APPROVED",
        reviewer: "Risk committee",
        approvedAt: "2026-06-15T00:00:00.000Z",
        digest: "new-digest",
        createdAt: "2026-06-15T00:00:00.000Z",
      },
    ]);

    expect(latest).toMatchObject({
      id: "new",
      status: "APPROVED",
      survivabilityScore: 91,
      reviewer: "Risk committee",
    });
  });

  it("blocks failed rehearsals and warns when critical services have no approved rehearsal", () => {
    expect(
      assessExitPlanRehearsalReadiness({
        criticality: "CRITICAL",
        latestRehearsal: {
          id: "rehearsal-1",
          scenarioType: "provider_failure",
          status: "FAILED",
          survivabilityScore: 42,
          reviewer: null,
          approvedAt: null,
          digest: "digest",
          createdAt: "2026-06-16T09:00:00.000Z",
        },
      }).blockers,
    ).toContain("exit-plan-rehearsal-failed");

    expect(
      assessExitPlanRehearsalReadiness({
        criticality: "IMPORTANT",
        latestRehearsal: null,
      }).warnings,
    ).toContain("exit-plan-rehearsal-missing");
  });
});
