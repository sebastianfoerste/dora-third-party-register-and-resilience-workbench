import { describe, expect, it } from "vitest";

import {
  runRegisterWorkflow,
  type RegisterContractInput,
  type RegisterVendorInput,
} from "../register-workflow";

function cleanVendors(): RegisterVendorInput[] {
  return [
    { id: "v1", name: "CloudCo", hasLegalEntity: true, serviceCount: 2, criticality: "CRITICAL" },
    { id: "v2", name: "DataCo", hasLegalEntity: true, serviceCount: 1, criticality: "NON_CRITICAL" },
  ];
}

function cleanContracts(): RegisterContractInput[] {
  return [
    { id: "c1", vendorId: "v1", hasRegisterEntry: true, missingHighSeverityFindings: 0 },
    { id: "c2", vendorId: "v2", hasRegisterEntry: true, missingHighSeverityFindings: 0 },
  ];
}

describe("register workflow agent", () => {
  it("allows the roi export only after full completion and reviewer approval", () => {
    const run = runRegisterWorkflow({
      runId: "reg-1",
      vendors: cleanVendors(),
      contracts: cleanContracts(),
      reviewerApproved: true,
    });
    expect(run.status).toBe("ready_for_review");
    expect(run.roiExportAllowed).toBe(true);
    expect(run.externalDeliveryAllowed).toBe(false);
  });

  it("blocks the vendor index on vendors without legal entity or services", () => {
    const vendors = cleanVendors();
    vendors[0] = { ...vendors[0], hasLegalEntity: false };
    const run = runRegisterWorkflow({
      runId: "reg-2",
      vendors,
      contracts: cleanContracts(),
      reviewerApproved: true,
    });
    const step = run.steps.find((candidate) => candidate.id === "vendor-index");
    expect(step?.status).toBe("blocked");
    expect(step?.blocker).toContain("CloudCo");
    expect(run.roiExportAllowed).toBe(false);
  });

  it("blocks on unassessed criticality and missing high-severity clauses", () => {
    const vendors = cleanVendors();
    vendors[1] = { ...vendors[1], criticality: null };
    const contracts = cleanContracts();
    contracts[0] = { ...contracts[0], missingHighSeverityFindings: 3 };
    const run = runRegisterWorkflow({
      runId: "reg-3",
      vendors,
      contracts,
      reviewerApproved: true,
    });
    expect(run.steps.find((step) => step.id === "criticality")?.status).toBe("blocked");
    expect(run.steps.find((step) => step.id === "clause-coverage")?.blocker).toContain("3");
    expect(run.status).toBe("blocked");
  });

  it("holds the export gate open for reviewer approval without blocking", () => {
    const run = runRegisterWorkflow({
      runId: "reg-4",
      vendors: cleanVendors(),
      contracts: cleanContracts(),
      reviewerApproved: false,
    });
    expect(run.status).toBe("awaiting_review");
    expect(run.steps.find((step) => step.id === "roi-export-gate")?.status).toBe("pending_review");
    expect(run.roiExportAllowed).toBe(false);
  });

  it("blocks register entries when contracts are not yet registered", () => {
    const contracts = cleanContracts();
    contracts[1] = { ...contracts[1], hasRegisterEntry: false };
    const run = runRegisterWorkflow({
      runId: "reg-5",
      vendors: cleanVendors(),
      contracts,
      reviewerApproved: true,
    });
    expect(run.steps.find((step) => step.id === "register-entries")?.status).toBe("blocked");
  });
});
