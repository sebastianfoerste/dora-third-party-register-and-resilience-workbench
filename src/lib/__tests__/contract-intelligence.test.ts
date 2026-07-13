import { describe, expect, it } from "vitest";

import {
  buildClauseReviewTable,
  buildContractVault,
  buildDemoContractIntelligenceWorkspace,
  runRemediationWorkflow,
} from "../contract-intelligence";

describe("DORA contract intelligence workspace", () => {
  it("builds a provenance-bound vault and blocks external sharing", () => {
    const { vault } = buildDemoContractIntelligenceWorkspace();

    expect(vault.schema).toBe("dora.contract-vault.v1");
    expect(vault.documentCount).toBe(3);
    expect(vault.vendorCount).toBe(1);
    expect(vault.externalSharingAllowed).toBe(false);
  });

  it("reviews each indexed contract against every required playbook column", () => {
    const { reviewTable } = buildDemoContractIntelligenceWorkspace();

    expect(reviewTable.rows).toHaveLength(2);
    expect(reviewTable.rows.every((row) => row.cells.length === 3)).toBe(true);
    expect(reviewTable.blockerCount).toBe(3);
    expect(reviewTable.rows.flatMap((row) => row.cells).every((cell) => cell.sourceRef)).toBe(true);
  });

  it("keeps remediation and delivery fail closed until blockers and review clear", () => {
    const { workflow } = buildDemoContractIntelligenceWorkspace();

    expect(workflow.status).toBe("blocked");
    expect(workflow.draftBoardPackAllowed).toBe(false);
    expect(workflow.externalDeliveryAllowed).toBe(false);
    expect(workflow.steps.some((step) => step.status === "pending_review")).toBe(true);
  });

  it("allows a reviewed draft only after complete playbook coverage", () => {
    const vault = buildContractVault({
      matterId: "matter-complete",
      name: "Complete synthetic matter",
      documents: [
        {
          id: "doc-complete",
          vendorId: "vendor-complete",
          vendorName: "Complete Provider (synthetic)",
          title: "Complete agreement",
          kind: "agreement",
          sourceRef: "fixture://contracts/complete",
          sourceStatus: "fixture",
          clauses: { audit_rights: "Audit clause" },
        },
      ],
    });
    const reviewTable = buildClauseReviewTable(vault, [
      { id: "audit_rights", label: "Audit rights", citation: "DORA Article 30(2)", required: true },
    ]);
    const workflow = runRemediationWorkflow({
      runId: "run-complete",
      vault,
      reviewTable,
      owner: "Legal",
      reviewerApproved: true,
    });

    expect(workflow.status).toBe("ready_for_review");
    expect(workflow.draftBoardPackAllowed).toBe(true);
    expect(workflow.externalDeliveryAllowed).toBe(false);
  });
});
