import { describe, expect, it } from "vitest";

import {
  buildBoardPackCommandCenterRows,
  summarizeBoardPackCommandCenter,
} from "../board-pack-command-center";
import type { BoardPackRegisterEntryProjection } from "../board-pack";

const baseEntry: BoardPackRegisterEntryProjection = {
  id: "entry-ready",
  criticality: "NON_CRITICAL",
  vendor: {
    id: "vendor-ready",
    legalName: "Ready Provider",
  },
  service: {
    id: "svc-ready",
    serviceDescription: "Ready service",
    supportedFunction: "Ready function",
    exitPlanStatus: "APPROVED",
    exitPlan: {
      status: "APPROVED",
      testedDate: "2026-06-01T00:00:00.000Z",
      reviewer: "Risk",
    },
    criticalityAssessments: [
      {
        status: "APPROVED",
        result: "NON_CRITICAL",
        reviewer: "Risk",
        evidence: "Synthetic board evidence",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    ],
    exitPlanRehearsals: [
      {
        id: "rehearsal-ready",
        serviceId: "svc-ready",
        scenarioType: "provider_failure",
        assumptionsJson: "{}",
        outcomeJson: "{}",
        survivabilityScore: 90,
        status: "APPROVED",
        reviewer: "Risk",
        approvedAt: "2026-06-02T00:00:00.000Z",
        digest: "digest-ready",
        createdAt: "2026-06-02T00:00:00.000Z",
      },
    ],
  },
  contract: {
    id: "contract-ready",
    sourceFile: "ready.pdf",
    clauseFindings: [
      {
        id: "finding-ready",
        status: "PRESENT",
        extractedEvidence: "RAW TEXT THAT MUST NOT APPEAR",
        requirement: {
          id: "req-ready",
          requirementName: "Ready clause",
        },
        remediationTasks: [],
      },
    ],
  },
};

describe("board pack command center", () => {
  it("sorts blocked rows first and links blockers to operational lanes", () => {
    const rows = buildBoardPackCommandCenterRows([
      baseEntry,
      {
        ...baseEntry,
        id: "entry-blocked",
        criticality: "CRITICAL",
        vendor: {
          id: "vendor-blocked",
          legalName: "Blocked Provider",
        },
        service: {
          ...baseEntry.service,
          id: "svc-blocked",
          serviceDescription: "Blocked service",
          exitPlanStatus: "DRAFT",
          exitPlan: {
            status: "DRAFT",
            testedDate: null,
            reviewer: null,
          },
          exitPlanRehearsals: [
            {
              id: "rehearsal-failed",
              serviceId: "svc-blocked",
              scenarioType: "provider_failure",
              assumptionsJson: "{}",
              outcomeJson: "{}",
              survivabilityScore: 40,
              status: "FAILED",
              digest: "digest-failed",
              createdAt: "2026-06-15T00:00:00.000Z",
            },
          ],
        },
        contract: {
          ...baseEntry.contract!,
          id: "contract-blocked",
          clauseFindings: [
            {
              id: "finding-missing",
              status: "MISSING",
              extractedEvidence: "CONFIDENTIAL RAW MISSING CLAUSE",
              requirement: {
                id: "req-missing",
                requirementName: "Missing clause",
              },
              remediationTasks: [
                {
                  id: "task-1",
                  title: "Fix missing clause",
                  severity: "HIGH",
                  status: "OPEN",
                  owner: "Legal",
                },
              ],
            },
          ],
        },
      },
    ]);

    expect(rows[0]).toMatchObject({
      registerEntryId: "entry-blocked",
      status: "BLOCKED",
      rehearsalStatus: "FAILED",
      rehearsalAction: "Open remediation, rerun the rehearsal, and approve the result.",
      rehearsalBlockingBoardPack: true,
      remediationStatus: "OPEN",
    });
    const summary = summarizeBoardPackCommandCenter(rows);
    expect(summary).toMatchObject({
      totalRows: 2,
      blockedRows: 1,
      criticalOrImportantRows: 1,
      rehearsalFailedRows: 1,
      rehearsalBlockingRows: 1,
    });
    expect(rows[0].packetHref).toBe("/api/exports/entry-blocked?kind=board-pack");
    expect(rows[0].manifestHref).toBe("/api/exports/entry-blocked?kind=board-pack&artifact=manifest");
    expect(rows[0].blockerLinks.some((link) => link.href === "/exit-plans")).toBe(true);
    expect(rows[0].blockerLinks.some((link) => link.href === "/remediation")).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("CONFIDENTIAL RAW MISSING CLAUSE");
  });
});
