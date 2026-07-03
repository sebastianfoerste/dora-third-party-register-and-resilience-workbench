import { createHash } from "node:crypto";

import {
  assessExitPlanRehearsalReadiness,
  summarizeLatestExitPlanRehearsal,
  type ExitPlanRehearsalRecord,
  type ExitPlanRehearsalSummary,
} from "./exit-plan-rehearsal";
import type { RemediationQueueSummary } from "./remediation-summary";
import { summarizeRemediationQueue, type RemediationQueueTask } from "./remediation-summary";
import type { ReadinessStatus } from "./workflow-readiness";

export type ClauseEvidenceStatus = "PRESENT" | "MISSING" | "NEEDS_REVIEW";

export interface BoardPackClause {
  clauseId: string;
  title: string;
  status: ClauseEvidenceStatus;
  evidenceReference?: string | null;
}

export interface BoardPackInput {
  providerId: string;
  providerName: string;
  serviceName: string;
  criticality: "CRITICAL" | "IMPORTANT" | "NON_CRITICAL";
  criticalityReviewed: boolean;
  exitPlanStatus?: "APPROVED" | "DRAFT" | "MISSING" | null;
  exitPlanScenarioEvidence?: string | null;
  latestExitPlanRehearsal?: ExitPlanRehearsalSummary | null;
  clauses: BoardPackClause[];
  remediation: RemediationQueueSummary;
  generatedAt?: string;
}

export interface BoardPackRegisterEntryProjection {
  id: string;
  vendor: {
    id: string;
    legalName: string;
  };
  service: {
    id: string;
    serviceDescription: string;
    supportedFunction: string;
    exitPlanStatus?: string | null;
    exitPlan?: {
      status: string;
      testedDate?: Date | string | null;
      reviewer?: string | null;
    } | null;
    criticalityAssessments?: Array<{
      status: string;
      result: string;
      reviewer?: string | null;
      evidence?: string | null;
      updatedAt?: Date | string | null;
      createdAt?: Date | string | null;
    }>;
    exitPlanRehearsals?: ExitPlanRehearsalRecord[];
  };
  criticality: string;
  contract?: {
    id: string;
    sourceFile: string;
    clauseFindings: Array<{
      id: string;
      status: string;
      extractedEvidence?: string | null;
      requirement: {
        id: string;
        requirementName: string;
      };
      remediationTasks?: Array<{
        id: string;
        title: string;
        severity: string;
        status: string;
        owner?: string | null;
        dueDate?: Date | string | null;
        resolutionEvidence?: string | null;
      }>;
    }>;
  } | null;
}

export interface BoardPack {
  schema: "dora-workbench.board-pack.v1";
  providerId: string;
  providerName: string;
  serviceName: string;
  criticality: BoardPackInput["criticality"];
  status: ReadinessStatus;
  generatedAt: string;
  clauses: BoardPackClause[];
  latestExitPlanRehearsal: ExitPlanRehearsalSummary | null;
  openEvidenceGaps: string[];
  gate: {
    status: ReadinessStatus;
    blockers: string[];
    warnings: string[];
  };
}

export interface BoardPackManifest {
  schema: "dora-workbench.board-pack-manifest.v1";
  providerId: string;
  generatedAt: string;
  packetDigest: string;
  artifactLabels: string[];
  reviewNotice: string;
}

export function buildBoardPack(input: BoardPackInput): BoardPack {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const openEvidenceGaps = input.clauses
    .filter((clause) => clause.status !== "PRESENT")
    .map((clause) => `${clause.clauseId}:${clause.status}`);

  if (!input.criticalityReviewed) {
    blockers.push("criticality-review-missing");
  }
  if ((input.criticality === "CRITICAL" || input.criticality === "IMPORTANT") && input.exitPlanStatus !== "APPROVED") {
    blockers.push("exit-plan-not-approved");
  }
  if (input.exitPlanStatus === "APPROVED" && !input.exitPlanScenarioEvidence?.trim()) {
    warnings.push("exit-plan-scenario-evidence-missing");
  }
  const rehearsalReadiness = assessExitPlanRehearsalReadiness({
    criticality: input.criticality,
    latestRehearsal: input.latestExitPlanRehearsal,
  });
  if (openEvidenceGaps.length > 0) {
    blockers.push("contract-evidence-gaps-open");
  }
  blockers.push(...input.remediation.blockers);
  blockers.push(...rehearsalReadiness.blockers);
  warnings.push(...input.remediation.warnings);
  warnings.push(...rehearsalReadiness.warnings);

  const uniqueBlockers = [...new Set(blockers)].sort();
  const uniqueWarnings = [...new Set(warnings)].sort();
  const status: ReadinessStatus =
    uniqueBlockers.length > 0 ? "BLOCKED" : uniqueWarnings.length > 0 ? "REVIEW_REQUIRED" : "READY";

  return {
    schema: "dora-workbench.board-pack.v1",
    providerId: input.providerId,
    providerName: input.providerName,
    serviceName: input.serviceName,
    criticality: input.criticality,
    status,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    clauses: input.clauses,
    latestExitPlanRehearsal: input.latestExitPlanRehearsal ?? null,
    openEvidenceGaps,
    gate: {
      status,
      blockers: uniqueBlockers,
      warnings: uniqueWarnings,
    },
  };
}

export function buildBoardPackInputFromRegisterEntry(
  entry: BoardPackRegisterEntryProjection,
  generatedAt?: string,
): BoardPackInput {
  const latestCriticality = [...(entry.service.criticalityAssessments ?? [])].sort(
    (left, right) => dateTime(right.updatedAt ?? right.createdAt) - dateTime(left.updatedAt ?? left.createdAt),
  )[0];

  const remediationTasks: RemediationQueueTask[] = (entry.contract?.clauseFindings ?? []).flatMap((finding) =>
    (finding.remediationTasks ?? []).map((task) => ({
      id: task.id,
      title: task.title,
      severity: normalizeRemediationSeverity(task.severity),
      status: normalizeRemediationStatus(task.status),
      owner: task.owner,
      dueDate: task.dueDate,
      resolutionEvidence: task.resolutionEvidence,
    })),
  );

  return {
    providerId: entry.vendor.id,
    providerName: entry.vendor.legalName,
    serviceName: entry.service.serviceDescription || entry.service.supportedFunction,
    criticality: normalizeCriticality(entry.criticality),
    criticalityReviewed: latestCriticality?.status === "APPROVED" && Boolean(latestCriticality.reviewer?.trim()),
    exitPlanStatus: normalizeExitPlanStatus(entry.service.exitPlan?.status ?? entry.service.exitPlanStatus),
    exitPlanScenarioEvidence: entry.service.exitPlan?.testedDate
      ? `exit-plan:${entry.service.id}:tested:${new Date(entry.service.exitPlan.testedDate).toISOString()}`
      : null,
    latestExitPlanRehearsal: summarizeLatestExitPlanRehearsal(entry.service.exitPlanRehearsals),
    clauses: (entry.contract?.clauseFindings ?? []).map((finding) => ({
      clauseId: finding.requirement.id,
      title: finding.requirement.requirementName,
      status: normalizeClauseStatus(finding.status),
      evidenceReference:
        finding.status === "PRESENT"
          ? `contract:${entry.contract?.id}:finding:${finding.id}:source:${entry.contract?.sourceFile}`
          : null,
    })),
    remediation: summarizeRemediationQueue(remediationTasks),
    generatedAt,
  };
}

export function buildBoardPackManifest(
  packet: BoardPack,
  artifactLabels: string[] = ["board-pack.json"],
): BoardPackManifest {
  return {
    schema: "dora-workbench.board-pack-manifest.v1",
    providerId: packet.providerId,
    generatedAt: packet.generatedAt,
    packetDigest: digestJson(packet),
    artifactLabels,
    reviewNotice: "Board pack manifest proves local packet integrity only. Legal review remains required.",
  };
}

function digestJson(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function normalizeCriticality(value: string): BoardPackInput["criticality"] {
  if (value === "CRITICAL" || value === "IMPORTANT" || value === "NON_CRITICAL") {
    return value;
  }
  return "NON_CRITICAL";
}

function normalizeClauseStatus(value: string): ClauseEvidenceStatus {
  if (value === "PRESENT") {
    return "PRESENT";
  }
  if (value === "MISSING") {
    return "MISSING";
  }
  return "NEEDS_REVIEW";
}

function normalizeExitPlanStatus(value?: string | null): BoardPackInput["exitPlanStatus"] {
  if (value === "APPROVED" || value === "DRAFT" || value === "MISSING") {
    return value;
  }
  if (value === "NONE") {
    return "MISSING";
  }
  return null;
}

function normalizeRemediationSeverity(value: string): RemediationQueueTask["severity"] {
  if (value === "HIGH" || value === "MEDIUM" || value === "LOW") {
    return value;
  }
  return "MEDIUM";
}

function normalizeRemediationStatus(value: string): RemediationQueueTask["status"] {
  if (value === "OPEN" || value === "IN_PROGRESS" || value === "RESOLVED") {
    return value;
  }
  return "OPEN";
}

function dateTime(value?: Date | string | null): number {
  return value ? new Date(value).getTime() : 0;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
