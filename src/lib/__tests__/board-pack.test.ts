import { describe, expect, it } from "vitest";

import { buildBoardPack, buildBoardPackInputFromRegisterEntry, buildBoardPackManifest } from "../board-pack";
import { summarizeRemediationQueue } from "../remediation-summary";

describe("board pack export", () => {
  it("keeps missing contract evidence visible in the packet gate", () => {
    const packet = buildBoardPack({
      providerId: "ict-provider-1",
      providerName: "Synthetic Cloud Provider",
      serviceName: "Critical hosting",
      criticality: "CRITICAL",
      criticalityReviewed: true,
      exitPlanStatus: "APPROVED",
      exitPlanScenarioEvidence: "Scenario test 2026-06-01",
      clauses: [
        {
          clauseId: "audit-right",
          title: "Audit right",
          status: "PRESENT",
          evidenceReference: "contract-section-12",
        },
        {
          clauseId: "subcontracting",
          title: "Subcontracting approval",
          status: "MISSING",
        },
      ],
      remediation: summarizeRemediationQueue([]),
      generatedAt: "2026-06-13T09:00:00.000Z",
    });

    expect(packet.status).toBe("BLOCKED");
    expect(packet.openEvidenceGaps).toEqual(["subcontracting:MISSING"]);
    expect(packet.gate.blockers).toContain("contract-evidence-gaps-open");
  });

  it("creates a stable manifest digest for reviewed packets", () => {
    const packet = buildBoardPack({
      providerId: "ict-provider-2",
      providerName: "Synthetic Data Room",
      serviceName: "Document exchange",
      criticality: "IMPORTANT",
      criticalityReviewed: true,
      exitPlanStatus: "APPROVED",
      exitPlanScenarioEvidence: "Scenario test 2026-06-01",
      latestExitPlanRehearsal: {
        id: "rehearsal-ready",
        scenarioType: "provider_failure",
        status: "APPROVED",
        survivabilityScore: 91,
        reviewer: "Risk committee",
        approvedAt: "2026-06-02T00:00:00.000Z",
        digest: "rehearsal-digest",
        createdAt: "2026-06-02T00:00:00.000Z",
      },
      clauses: [
        {
          clauseId: "termination-assistance",
          title: "Termination assistance",
          status: "PRESENT",
          evidenceReference: "contract-section-18",
        },
      ],
      remediation: summarizeRemediationQueue([]),
      generatedAt: "2026-06-13T09:00:00.000Z",
    });

    const manifest = buildBoardPackManifest(packet);

    expect(packet.status).toBe("READY");
    expect(manifest.schema).toBe("dora-workbench.board-pack-manifest.v1");
    expect(manifest.packetDigest).toHaveLength(64);
    expect(manifest.reviewNotice).toContain("Legal review remains required");
  });

  it("includes latest exit-plan rehearsal state in management board packs", () => {
    const packet = buildBoardPack({
      providerId: "ict-provider-3",
      providerName: "Synthetic Resilience Provider",
      serviceName: "Trading continuity",
      criticality: "IMPORTANT",
      criticalityReviewed: true,
      exitPlanStatus: "APPROVED",
      exitPlanScenarioEvidence: "exit-plan:svc-1:tested:2026-06-13T00:00:00.000Z",
      latestExitPlanRehearsal: {
        id: "rehearsal-1",
        scenarioType: "provider_failure",
        status: "APPROVED",
        survivabilityScore: 88,
        reviewer: "Risk committee",
        approvedAt: "2026-06-13T00:00:00.000Z",
        digest: "rehearsal-digest",
        createdAt: "2026-06-13T00:00:00.000Z",
      },
      clauses: [
        {
          clauseId: "exit-assistance",
          title: "Exit assistance",
          status: "PRESENT",
          evidenceReference: "contract-section-18",
        },
      ],
      remediation: summarizeRemediationQueue([]),
      generatedAt: "2026-06-13T09:00:00.000Z",
    });

    expect(packet.status).toBe("READY");
    expect(packet.latestExitPlanRehearsal).toMatchObject({
      id: "rehearsal-1",
      status: "APPROVED",
      survivabilityScore: 88,
    });
  });

  it("projects register entries without leaking raw extracted contract evidence", () => {
    const input = buildBoardPackInputFromRegisterEntry(
      {
        id: "entry-1",
        criticality: "IMPORTANT",
        vendor: {
          id: "vendor-1",
          legalName: "Synthetic ICT Provider",
        },
        service: {
          id: "service-1",
          serviceDescription: "Hosted transaction monitoring",
          supportedFunction: "AML monitoring",
          exitPlanStatus: "APPROVED",
          exitPlan: {
            status: "APPROVED",
            testedDate: "2026-06-10T00:00:00.000Z",
            reviewer: "Risk committee",
          },
          criticalityAssessments: [
            {
              status: "APPROVED",
              result: "IMPORTANT",
              reviewer: "Risk committee",
              evidence: "Board memo reference, not exported as raw text.",
            },
          ],
          exitPlanRehearsals: [
            {
              id: "rehearsal-ready",
              serviceId: "service-1",
              scenarioType: "provider_failure",
              assumptionsJson: "{}",
              outcomeJson: "{}",
              survivabilityScore: 91,
              status: "APPROVED",
              reviewer: "Risk committee",
              approvedAt: "2026-06-11T00:00:00.000Z",
              digest: "rehearsal-digest",
              createdAt: "2026-06-11T00:00:00.000Z",
            },
          ],
        },
        contract: {
          id: "contract-1",
          sourceFile: "synthetic-master-services.pdf",
          clauseFindings: [
            {
              id: "finding-audit",
              status: "PRESENT",
              extractedEvidence: "CONFIDENTIAL RAW CLAUSE TEXT SHOULD NOT LEAK",
              requirement: {
                id: "req-audit",
                requirementName: "Unrestricted audit rights",
              },
              remediationTasks: [
                {
                  id: "task-1",
                  title: "Close old notice-period finding",
                  severity: "LOW",
                  status: "RESOLVED",
                  owner: "legal@example.test",
                  resolutionEvidence: "Synthetic closure memo.",
                },
              ],
            },
          ],
        },
      },
      "2026-06-13T09:00:00.000Z",
    );

    const packet = buildBoardPack(input);
    const packetJson = JSON.stringify(packet);

    expect(packet.status).toBe("READY");
    expect(packet.clauses[0]).toMatchObject({
      clauseId: "req-audit",
      status: "PRESENT",
      evidenceReference: "contract:contract-1:finding:finding-audit:source:synthetic-master-services.pdf",
    });
    expect(packetJson).not.toContain("CONFIDENTIAL RAW CLAUSE TEXT SHOULD NOT LEAK");
  });
});
