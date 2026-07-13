import { describe, expect, it } from "vitest";

import { triageDoraMariskBoundary } from "../dora-marisk-triage";

describe("DORA and MaRisk boundary triage", () => {
  it("routes ICT services to DORA review and records the AT 9 exclusion rationale", () => {
    const decision = triageDoraMariskBoundary({
      arrangementId: "arr-cloud-1",
      serviceDescription: "Cloud hosting for the resilience workbench",
      isIctService: true,
      supportsCriticalOrImportantFunction: true,
      wouldOtherwiseBePerformedByInstitution: true,
      evidenceRefs: ["contract:cloud-hosting:section:services"],
    });

    expect(decision.route).toBe("DORA_ICT_THIRD_PARTY_RISK");
    expect(decision.reviewState).toBe("ready_for_dora_review");
    expect(decision.blockers).toEqual([]);
    expect(decision.rationale.join(" ")).toContain("outside the AT 9 outsourcing module");
    expect(JSON.stringify(decision)).not.toContain("Cloud provider confidential quote");
  });

  it("routes non-ICT institutional substitution to MaRisk AT 9 review", () => {
    const decision = triageDoraMariskBoundary({
      arrangementId: "arr-backoffice-1",
      serviceDescription: "Recurring back-office process support",
      isIctService: false,
      wouldOtherwiseBePerformedByInstitution: true,
      isOneOffOrOccasionalPurchase: false,
    });

    expect(decision.route).toBe("MARISK_AT9_OUTSOURCING_REVIEW");
    expect(decision.reviewState).toBe("ready_for_marisk_review");
    expect(decision.blockers).toEqual([]);
  });

  it("fails closed when core classification facts are missing", () => {
    const decision = triageDoraMariskBoundary({
      arrangementId: "arr-unknown-1",
      serviceDescription: "Vendor support arrangement",
    });

    expect(decision.route).toBe("MANUAL_BOUNDARY_REVIEW");
    expect(decision.reviewState).toBe("manual_review_required");
    expect(decision.blockers).toContain("missing-ict-service-classification");
  });
});
