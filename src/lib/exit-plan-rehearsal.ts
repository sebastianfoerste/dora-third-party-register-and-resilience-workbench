import { createHash } from "node:crypto";

import type { Criticality, ReadinessAssessment } from "./workflow-readiness";

export type ExitPlanRehearsalStatus = "DRAFT" | "COMPLETED" | "FAILED" | "APPROVED";

export interface ExitPlanRehearsalRecord {
  id: string;
  serviceId: string;
  scenarioType: string;
  assumptionsJson: string;
  outcomeJson: string;
  survivabilityScore: number;
  status: string;
  reviewer?: string | null;
  approvedAt?: Date | string | null;
  digest: string;
  createdAt: Date | string;
}

export interface ExitPlanRehearsalInput {
  serviceId: string;
  scenarioType: string;
  assumptions: Record<string, unknown>;
  outcome: Record<string, unknown>;
  survivabilityScore: number;
  status: ExitPlanRehearsalStatus;
  reviewer?: string | null;
  approvedAt?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface ExitPlanRehearsalSummary {
  id: string;
  scenarioType: string;
  status: ExitPlanRehearsalStatus;
  survivabilityScore: number;
  reviewer: string | null;
  approvedAt: string | null;
  digest: string;
  createdAt: string;
}

export function buildExitPlanRehearsalCreateInput(input: ExitPlanRehearsalInput) {
  const createdAt = input.createdAt ? new Date(input.createdAt) : new Date();
  const assumptionsJson = stableStringify(input.assumptions);
  const outcomeJson = stableStringify(input.outcome);
  const digest = digestRehearsal({
    serviceId: input.serviceId,
    scenarioType: input.scenarioType,
    assumptionsJson,
    outcomeJson,
    survivabilityScore: input.survivabilityScore,
    status: input.status,
    reviewer: input.reviewer ?? null,
    approvedAt: input.approvedAt ? new Date(input.approvedAt).toISOString() : null,
    createdAt: createdAt.toISOString(),
  });

  return {
    serviceId: input.serviceId,
    scenarioType: input.scenarioType,
    assumptionsJson,
    outcomeJson,
    survivabilityScore: input.survivabilityScore,
    status: input.status,
    reviewer: input.reviewer,
    approvedAt: input.approvedAt ? new Date(input.approvedAt) : null,
    digest,
    createdAt,
  };
}

export function summarizeLatestExitPlanRehearsal(
  rehearsals: ExitPlanRehearsalRecord[] = [],
): ExitPlanRehearsalSummary | null {
  const latest = [...rehearsals].sort((left, right) => dateTime(right.createdAt) - dateTime(left.createdAt))[0];
  if (!latest) {
    return null;
  }

  return {
    id: latest.id,
    scenarioType: latest.scenarioType,
    status: normalizeRehearsalStatus(latest.status),
    survivabilityScore: latest.survivabilityScore,
    reviewer: latest.reviewer ?? null,
    approvedAt: latest.approvedAt ? new Date(latest.approvedAt).toISOString() : null,
    digest: latest.digest,
    createdAt: new Date(latest.createdAt).toISOString(),
  };
}

export function assessExitPlanRehearsalReadiness(input: {
  criticality: Criticality;
  latestRehearsal?: ExitPlanRehearsalSummary | null;
}): ReadinessAssessment {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const isCriticalOrImportant = input.criticality === "CRITICAL" || input.criticality === "IMPORTANT";

  if (!isCriticalOrImportant) {
    return { status: "READY", blockers, warnings };
  }

  if (!input.latestRehearsal) {
    warnings.push("exit-plan-rehearsal-missing");
  } else if (input.latestRehearsal.status === "FAILED") {
    blockers.push("exit-plan-rehearsal-failed");
  } else if (input.latestRehearsal.status !== "APPROVED") {
    warnings.push("exit-plan-rehearsal-not-approved");
  }

  if (input.latestRehearsal?.status === "APPROVED" && !input.latestRehearsal.reviewer?.trim()) {
    warnings.push("exit-plan-rehearsal-reviewer-missing");
  }

  return {
    status: blockers.length > 0 ? "BLOCKED" : warnings.length > 0 ? "REVIEW_REQUIRED" : "READY",
    blockers,
    warnings,
  };
}

function digestRehearsal(value: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function normalizeRehearsalStatus(value: string): ExitPlanRehearsalStatus {
  if (value === "DRAFT" || value === "COMPLETED" || value === "FAILED" || value === "APPROVED") {
    return value;
  }
  return "DRAFT";
}

function dateTime(value: Date | string): number {
  return new Date(value).getTime();
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
