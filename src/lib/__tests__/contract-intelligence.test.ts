import { describe, expect, it } from "vitest";

import {
  buildClauseReviewTable,
  buildContractVault,
  buildDemoContractIntelligenceWorkspace,
  runRemediationWorkflow,
} from "../contract-intelligence";
import {
  buildDemoLegoraWorkspace,
  decideChange,
  lockReviewCell,
  renderReviewedDocx,
  resolveRemediationItem,
} from "../legora-workspace";

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

  it("adds stable collaborative cells and rejects stale lock revisions", () => {
    const { vault, reviewTable } = buildDemoContractIntelligenceWorkspace();
    const { collaboration } = buildDemoLegoraWorkspace(vault, reviewTable);
    const locked = lockReviewCell({ workspace: collaboration, cellId: collaboration.cells[0].id, actor: "Reviewer", expectedRevision: 1, now: new Date("2026-07-13T10:00:00Z") });

    expect(locked.cells[0].revision).toBe(2);
    expect(() => lockReviewCell({ workspace: locked, cellId: locked.cells[0].id, actor: "Other reviewer", expectedRevision: 1, now: new Date("2026-07-13T10:01:00Z") })).toThrow("409 Conflict");
  });

  it("keeps DOCX export blocked until every change is accepted", async () => {
    const { vault, reviewTable } = buildDemoContractIntelligenceWorkspace();
    let { changeSet } = buildDemoLegoraWorkspace(vault, reviewTable);
    await expect(renderReviewedDocx({ title: "DORA review", changeSet })).rejects.toThrow("every change");
    for (const change of changeSet.changes) changeSet = decideChange(changeSet, change.id, "accepted");
    const output = await renderReviewedDocx({ title: "DORA review", changeSet });
    expect(Buffer.from(output).subarray(0, 2).toString()).toBe("PK");
  });

  it("requires resolution evidence for remediation Lists", () => {
    const { vault, reviewTable } = buildDemoContractIntelligenceWorkspace();
    const { remediationList } = buildDemoLegoraWorkspace(vault, reviewTable);
    expect(() => resolveRemediationItem(remediationList, remediationList.items[0].id, [])).toThrow("evidence");
    expect(resolveRemediationItem(remediationList, remediationList.items[0].id, ["fixture://evidence/accepted"]).items[0].status).toBe("resolved");
  });
});
