import { describe, expect, it } from "vitest";
import { buildBatchReview, type PersistedContractInput } from "../batch-review";
const requirements = [{ id: "b", requirementName: "Locations", regulatoryBasis: "DORA Art. 30(2)(b)", applicability: "ALL_ICT" }, { id: "d", requirementName: "SLAs", regulatoryBasis: "DORA Art. 30(2)(d)", applicability: "ALL_ICT" }];
const contracts: PersistedContractInput[] = [{ id: "c1", vendorId: "v1", vendorName: "CloudCo", sourceFile: "cloud.pdf", hasProvenance: true, findings: [{ requirementId: "b", status: "PRESENT", extractedEvidence: "Frankfurt and Dublin" }, { requirementId: "d", status: "MISSING", extractedEvidence: null }] }, { id: "c2", vendorId: "v2", vendorName: "DataCo", sourceFile: "data.pdf", hasProvenance: false, findings: [{ requirementId: "b", status: "PARTIAL", extractedEvidence: "Production only" }] }];
describe("batch review", () => {
  it("maps contracts with provenance", () => { const result = buildBatchReview({ runName: "sweep", matterId: "m", contracts, requirements }); expect(result.vault.documentCount).toBe(2); expect(result.vault.documents.map(d => d.sourceStatus)).toEqual(["verified", "fixture"]); expect(result.vault.externalSharingAllowed).toBe(false); });
  it("reviews all cells and counts blockers", () => { const result = buildBatchReview({ runName: "sweep", matterId: "m", contracts, requirements }); expect(result.reviewTable.rows).toHaveLength(2); expect(result.blockerCount).toBe(2); expect(result.requiresHumanReview).toBe(true); });
  it("keeps evidence text", () => { const result = buildBatchReview({ runName: "sweep", matterId: "m", contracts, requirements }); expect(result.reviewTable.rows.find(r => r.documentId === "c1")?.cells.find(c => c.columnId === "b")?.value).toContain("Frankfurt"); });
});
