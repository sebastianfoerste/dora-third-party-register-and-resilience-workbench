import { createHash } from "node:crypto";

export interface ContractEvidenceMapInput {
  contract: {
    id: string;
    sourceFile: string;
    provenanceMap?: string | null;
    clauseFindings: Array<{
      id: string;
      status: string;
      reviewerDecision?: string | null;
      reviewerComments?: string | null;
      extractedEvidence?: string | null;
      requirement: {
        id: string;
        regulatoryBasis: string;
        requirementName: string;
        severity: string;
      };
    }>;
  };
  generatedAt?: string;
}

export interface ContractEvidenceMapEntry {
  findingId: string;
  requirementId: string;
  requirementName: string;
  regulatoryBasis: string;
  severity: string;
  status: string;
  reviewerDecision: string | null;
  sourceReference: string;
  evidenceState: "linked" | "missing" | "needs_review";
}

export interface ContractEvidenceMap {
  schema: "dora-workbench.contract-evidence-map.v1";
  contractId: string;
  sourceFile: string;
  generatedAt: string;
  entries: ContractEvidenceMapEntry[];
  blockers: string[];
  warnings: string[];
  digest: string;
  reviewNotice: string;
}

export function buildContractEvidenceMap(input: ContractEvidenceMapInput): ContractEvidenceMap {
  const provenance = parseProvenanceMap(input.contract.provenanceMap);
  const entries = input.contract.clauseFindings.map((finding) => {
    const sourceReference =
      provenance[finding.requirement.id] ??
      provenance[finding.id] ??
      `contract:${input.contract.id}:finding:${finding.id}:source:${input.contract.sourceFile}`;
    return {
      findingId: finding.id,
      requirementId: finding.requirement.id,
      requirementName: finding.requirement.requirementName,
      regulatoryBasis: finding.requirement.regulatoryBasis,
      severity: finding.requirement.severity,
      status: finding.status,
      reviewerDecision: finding.reviewerDecision ?? null,
      sourceReference,
      evidenceState: evidenceState(finding.status),
    };
  });

  const blockers = entries
    .filter((entry) => entry.severity === "HIGH" && entry.evidenceState !== "linked")
    .map((entry) => `high-evidence-gap:${entry.requirementId}`);
  const warnings = entries
    .filter((entry) => entry.evidenceState === "needs_review")
    .map((entry) => `evidence-needs-review:${entry.requirementId}`);

  const unsigned = {
    schema: "dora-workbench.contract-evidence-map.v1" as const,
    contractId: input.contract.id,
    sourceFile: input.contract.sourceFile,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    entries,
    blockers: [...new Set(blockers)].sort(),
    warnings: [...new Set(warnings)].sort(),
    reviewNotice: "Evidence map stores metadata and source references only. Review the underlying contract before relying on any legal conclusion.",
  };

  return {
    ...unsigned,
    digest: createHash("sha256").update(stableStringify(unsigned)).digest("hex"),
  };
}

function evidenceState(status: string): ContractEvidenceMapEntry["evidenceState"] {
  if (status === "PRESENT" || status === "NOT_APPLICABLE") {
    return "linked";
  }
  if (status === "MISSING") {
    return "missing";
  }
  return "needs_review";
}

function parseProvenanceMap(value?: string | null): Record<string, string> {
  if (!value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, item]) => typeof item === "string")
        .map(([key, item]) => [key, item as string]),
    );
  } catch {
    return {};
  }
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
