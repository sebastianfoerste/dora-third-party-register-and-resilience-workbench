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
  rehearsalAction: string;
  rehearsalDigest: string | null;
  rehearsalBlockingBoardPack: boolean;
  remediationStatus: string;
  packetDigest: string;
  packetHref: string;
  manifestHref: string;
  reviewHref: string;
  blockerLinks: Array<{ label: string; href: string }>;
}

export interface BoardPackCommandCenterSummary {
  totalRows: number;
  blockedRows: number;
  reviewRequiredRows: number;
  readyRows: number;
  criticalOrImportantRows: number;
  rehearsalMissingOrNotApprovedRows: number;
  rehearsalFailedRows: number;
  rehearsalBlockingRows: number;
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
        exitPlanStatus: entry.service?.exitPlan?.status ?? entry.service?.exitPlanStatus ?? null,
        rehearsalStatus: packet.latestExitPlanRehearsal?.status ?? null,
        rehearsalAction: rehearsalAction(packet),
        rehearsalDigest: packet.latestExitPlanRehearsal?.digest ?? null,
        rehearsalBlockingBoardPack: packet.gate.blockers.some((blocker) =>
          blocker.startsWith("exit-plan-rehearsal"),
        ),
        remediationStatus: entry.contract?.clauseFindings?.some((finding) =>
          finding.remediationTasks?.some((task) => task.status !== "RESOLVED") ?? false,
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

export function summarizeBoardPackCommandCenter(
  rows: BoardPackCommandCenterRow[],
): BoardPackCommandCenterSummary {
  return {
    totalRows: rows.length,
    blockedRows: rows.filter((row) => row.status === "BLOCKED").length,
    reviewRequiredRows: rows.filter((row) => row.status === "REVIEW_REQUIRED").length,
    readyRows: rows.filter((row) => row.status === "READY").length,
    criticalOrImportantRows: rows.filter((row) => row.criticality !== "NON_CRITICAL").length,
    rehearsalMissingOrNotApprovedRows: rows.filter(
      (row) =>
        row.criticality !== "NON_CRITICAL" &&
        (!row.rehearsalStatus || row.rehearsalStatus !== "APPROVED"),
    ).length,
    rehearsalFailedRows: rows.filter((row) => row.rehearsalStatus === "FAILED").length,
    rehearsalBlockingRows: rows.filter((row) => row.rehearsalBlockingBoardPack).length,
  };
}

function rehearsalAction(packet: BoardPack) {
  if (packet.criticality === "NON_CRITICAL") {
    return "No rehearsal required for non-critical service.";
  }
  const rehearsal = packet.latestExitPlanRehearsal;
  if (!rehearsal) {
    return "Schedule and evidence an exit-plan rehearsal.";
  }
  if (rehearsal.status === "FAILED") {
    return "Open remediation, rerun the rehearsal, and approve the result.";
  }
  if (rehearsal.status !== "APPROVED") {
    return "Complete reviewer approval for the latest rehearsal.";
  }
  if (!rehearsal.reviewer?.trim()) {
    return "Add reviewer evidence for the approved rehearsal.";
  }
  return "Rehearsal evidence is ready for board-pack review.";
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
