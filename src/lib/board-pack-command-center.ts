import {
  buildBoardPack,
  buildBoardPackInputFromRegisterEntry,
  buildBoardPackManifest,
  type BoardPack,
  type BoardPackRegisterEntryProjection,
} from "./board-pack";

export interface BoardPackCommandCenterRow {
  registerEntryId: string;
  providerName: string;
  serviceName: string;
  criticality: BoardPack["criticality"];
  status: BoardPack["status"];
  blockerCount: number;
  warningCount: number;
  evidenceGapCount: number;
  exitPlanStatus: string | null;
  rehearsalStatus: string | null;
  remediationStatus: string;
  packetDigest: string;
  packetHref: string;
  manifestHref: string;
  reviewHref: string;
  blockerLinks: Array<{ label: string; href: string }>;
}

export function buildBoardPackCommandCenterRows(
  entries: BoardPackRegisterEntryProjection[],
): BoardPackCommandCenterRow[] {
  return entries
    .map((entry) => {
      const packet = buildBoardPack(buildBoardPackInputFromRegisterEntry(entry));
      const manifest = buildBoardPackManifest(packet);
      return {
        registerEntryId: entry.id,
        providerName: packet.providerName,
        serviceName: packet.serviceName,
        criticality: packet.criticality,
        status: packet.status,
        blockerCount: packet.gate.blockers.length,
        warningCount: packet.gate.warnings.length,
        evidenceGapCount: packet.openEvidenceGaps.length,
        exitPlanStatus: entry.service.exitPlan?.status ?? entry.service.exitPlanStatus ?? null,
        rehearsalStatus: packet.latestExitPlanRehearsal?.status ?? null,
        remediationStatus: entry.contract?.clauseFindings.some((finding) =>
          finding.remediationTasks?.some((task) => task.status !== "RESOLVED"),
        )
          ? "OPEN"
          : "CLEAR",
        packetDigest: manifest.packetDigest,
        packetHref: `/api/exports/${entry.id}?kind=board-pack`,
        manifestHref: `/api/exports/${entry.id}?kind=board-pack&artifact=manifest`,
        reviewHref: reviewHref(entry),
        blockerLinks: blockerLinks(packet.gate.blockers, entry),
      };
    })
    .sort((left, right) => {
      const statusDelta = statusRank(left.status) - statusRank(right.status);
      if (statusDelta !== 0) return statusDelta;
      return right.blockerCount - left.blockerCount || right.evidenceGapCount - left.evidenceGapCount;
    });
}

function blockerLinks(blockers: string[], entry: BoardPackRegisterEntryProjection) {
  const links = blockers.map((blocker) => {
    if (blocker.includes("criticality")) {
      return { label: blocker, href: `/vendors/${entry.vendor.id}` };
    }
    if (blocker.includes("exit-plan") || blocker.includes("rehearsal")) {
      return { label: blocker, href: "/exit-plans" };
    }
    if (blocker.includes("remediation")) {
      return { label: blocker, href: "/remediation" };
    }
    if (blocker.includes("contract") || blocker.includes("clause")) {
      return { label: blocker, href: entry.contract ? `/contracts/${entry.contract.id}` : "/contracts" };
    }
    return { label: blocker, href: "/audit-logs" };
  });

  return [...new Map(links.map((link) => [`${link.label}:${link.href}`, link])).values()];
}

function reviewHref(entry: BoardPackRegisterEntryProjection) {
  if (entry.contract) {
    return `/contracts/${entry.contract.id}`;
  }
  return `/vendors/${entry.vendor.id}`;
}

function statusRank(status: BoardPack["status"]) {
  if (status === "BLOCKED") return 0;
  if (status === "REVIEW_REQUIRED") return 1;
  return 2;
}
