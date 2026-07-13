import { createHash } from "node:crypto";

import JSZip from "jszip";
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

  it("preserves source DOCX content and exports accepted changes only", async () => {
    const { vault, reviewTable } = buildDemoContractIntelligenceWorkspace();
    let { changeSet } = buildDemoLegoraWorkspace(vault, reviewTable);
    const sourceArchive = new JSZip();
    sourceArchive.file(
      "word/document.xml",
      "<w:document xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'><w:body><w:p><w:r><w:t>Original source and table content</w:t></w:r></w:p><w:sectPr/></w:body></w:document>",
    );
    const source = await sourceArchive.generateAsync({ type: "uint8array" });
    changeSet = { ...changeSet, sourceDigest: createHash("sha256").update(source).digest("hex") };
    await expect(renderReviewedDocx({ source, changeSet })).rejects.toThrow("every change");
    changeSet = decideChange(changeSet, changeSet.changes[0].id, "accepted");
    for (const change of changeSet.changes.slice(1)) {
      changeSet = decideChange(changeSet, change.id, "rejected");
    }
    const output = await renderReviewedDocx({ source, changeSet });
    expect(Buffer.from(output).subarray(0, 2).toString()).toBe("PK");
    const reviewed = await JSZip.loadAsync(output);
    const xml = await reviewed.file("word/document.xml")?.async("string");
    expect(xml).toContain("Original source and table content");
    expect(xml?.match(/<w:ins/g)).toHaveLength(1);
  });

  it("canonicalizes change-set digests and treats replacement text literally", async () => {
    const { vault, reviewTable } = buildDemoContractIntelligenceWorkspace();
    const reorderedVault = {
      ...vault,
      documents: [...vault.documents]
        .reverse()
        .map((document) => ({ ...document, clauses: Object.fromEntries(Object.entries(document.clauses).reverse()) })),
    };
    const first = buildDemoLegoraWorkspace(vault, reviewTable).changeSet;
    let second = buildDemoLegoraWorkspace(reorderedVault, reviewTable).changeSet;
    expect(second.sourceDigest).toBe(first.sourceDigest);

    const archive = new JSZip();
    archive.file("word/document.xml", "<w:document><w:body><w:sectPr/></w:body></w:document>");
    const source = await archive.generateAsync({ type: "uint8array" });
    second = {
      ...second,
      sourceDigest: createHash("sha256").update(source).digest("hex"),
      exportAllowed: true,
      changes: [{ ...second.changes[0], decision: "accepted", proposedText: "$& <literal>" }],
    };
    const output = await renderReviewedDocx({ source, changeSet: second });
    const reviewed = await JSZip.loadAsync(output);
    expect(await reviewed.file("word/document.xml")?.async("string")).toContain(
      "$&amp; &lt;literal&gt;",
    );
  });

  it("handles externally supplied documents without clause projections", () => {
    const { vault } = buildDemoContractIntelligenceWorkspace();
    const externalVault = {
      ...vault,
      documents: vault.documents.map((document, index) =>
        index === 0 ? { ...document, clauses: undefined } : document,
      ),
    } as unknown as typeof vault;
    const table = buildClauseReviewTable(externalVault, [
      { id: "audit_rights", label: "Audit rights", citation: "DORA Article 30(2)", required: true },
    ]);
    expect(table.rows[0].cells.every((cell) => cell.value.includes("No supported clause"))).toBe(true);
    expect(() => buildDemoLegoraWorkspace(externalVault, table)).not.toThrow();
  });

  it("requires resolution evidence for remediation Lists", () => {
    const { vault, reviewTable } = buildDemoContractIntelligenceWorkspace();
    const { remediationList } = buildDemoLegoraWorkspace(vault, reviewTable);
    expect(() => resolveRemediationItem(remediationList, remediationList.items[0].id, [])).toThrow("evidence");
    expect(resolveRemediationItem(remediationList, remediationList.items[0].id, ["fixture://evidence/accepted"]).items[0].status).toBe("resolved");
  });
});
