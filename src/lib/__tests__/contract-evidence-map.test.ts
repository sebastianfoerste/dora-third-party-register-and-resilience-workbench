import { describe, expect, it } from "vitest";

import { buildContractEvidenceMap } from "../contract-evidence-map";

describe("contract evidence map", () => {
  it("projects source metadata without leaking raw contract evidence", () => {
    const map = buildContractEvidenceMap({
      contract: {
        id: "contract-1",
        sourceFile: "outsourcing-agreement.pdf",
        provenanceMap: JSON.stringify({ req_audit: "page:12:section:audit-right" }),
        clauseFindings: [
          {
            id: "finding-1",
            status: "PRESENT",
            reviewerDecision: "APPROVED",
            extractedEvidence: "CONFIDENTIAL CONTRACT QUOTE MUST NOT APPEAR",
            requirement: {
              id: "req_audit",
              regulatoryBasis: "DORA Art. 30(2)(f)",
              requirementName: "Access and audit rights",
              severity: "HIGH",
            },
          },
          {
            id: "finding-2",
            status: "MISSING",
            extractedEvidence: "ANOTHER RAW CLAUSE",
            requirement: {
              id: "req_exit",
              regulatoryBasis: "DORA Art. 30(2)(g)",
              requirementName: "Exit assistance",
              severity: "HIGH",
            },
          },
        ],
      },
      generatedAt: "2026-06-16T09:00:00.000Z",
    });

    const serialized = JSON.stringify(map);

    expect(map.schema).toBe("dora-workbench.contract-evidence-map.v1");
    expect(map.entries[0]).toMatchObject({
      findingId: "finding-1",
      sourceReference: "page:12:section:audit-right",
      evidenceState: "linked",
    });
    expect(map.blockers).toEqual(["high-evidence-gap:req_exit"]);
    expect(map.digest).toHaveLength(64);
    expect(serialized).not.toContain("CONFIDENTIAL CONTRACT QUOTE MUST NOT APPEAR");
    expect(serialized).not.toContain("ANOTHER RAW CLAUSE");
  });
});
