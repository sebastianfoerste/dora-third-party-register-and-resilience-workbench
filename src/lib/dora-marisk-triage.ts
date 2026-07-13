export type TriageRoute =
  | "DORA_ICT_THIRD_PARTY_RISK"
  | "MARISK_AT9_OUTSOURCING_REVIEW"
  | "MANUAL_BOUNDARY_REVIEW";

export interface DoraMariskTriageInput {
  arrangementId: string;
  serviceDescription: string;
  isIctService?: boolean;
  supportsCriticalOrImportantFunction?: boolean;
  wouldOtherwiseBePerformedByInstitution?: boolean;
  isOneOffOrOccasionalPurchase?: boolean;
  isTypicallyProvidedBySupervisedEntity?: boolean;
  evidenceRefs?: string[];
}

export interface DoraMariskTriageDecision {
  schema: "dora-workbench.dora-marisk-triage.v1";
  arrangementId: string;
  route: TriageRoute;
  reviewState: "ready_for_dora_review" | "ready_for_marisk_review" | "manual_review_required";
  rationale: string[];
  blockers: string[];
  sourceBasis: string[];
  evidenceRefs: string[];
  reviewNotice: string;
}

const DORA_SOURCE =
  "Regulation (EU) 2022/2554, Chapter V and Articles 28 to 30 on ICT third-party risk and contractual provisions";
const MARISK_SOURCE =
  "BaFin/Bundesbank consultation draft for the 9th MaRisk amendment, AT 9 margin notes 1 to 2, consultation 02/2026";

export function triageDoraMariskBoundary(input: DoraMariskTriageInput): DoraMariskTriageDecision {
  const blockers = missingCoreFacts(input);
  const sourceBasis = [DORA_SOURCE, MARISK_SOURCE];
  const evidenceRefs = [...(input.evidenceRefs ?? [])];

  if (blockers.length > 0) {
    return decision(input, "MANUAL_BOUNDARY_REVIEW", "manual_review_required", [
      "The arrangement is missing core boundary facts.",
      "The review fails closed until ICT-service status and outsourcing facts are confirmed.",
    ], blockers, sourceBasis, evidenceRefs);
  }

  if (input.isIctService === true) {
    const criticality = input.supportsCriticalOrImportantFunction
      ? "The arrangement supports a critical or important function."
      : "The arrangement is an ICT service and still requires DORA third-party risk review.";
    return decision(input, "DORA_ICT_THIRD_PARTY_RISK", "ready_for_dora_review", [
      criticality,
      "The BaFin consultation draft treats outsourced or procured ICT services that fall under DORA Articles 28 to 30 as outside the AT 9 outsourcing module.",
    ], [], sourceBasis, evidenceRefs);
  }

  if (input.wouldOtherwiseBePerformedByInstitution === true && !input.isOneOffOrOccasionalPurchase) {
    return decision(input, "MARISK_AT9_OUTSOURCING_REVIEW", "ready_for_marisk_review", [
      "The arrangement is not classified as an ICT service for DORA routing.",
      "The activity would otherwise be performed by the institution and is not a one-off or occasional purchase.",
      "The arrangement should enter MaRisk AT 9 outsourcing review subject to legal confirmation.",
    ], [], sourceBasis, evidenceRefs);
  }

  if (input.isOneOffOrOccasionalPurchase || input.isTypicallyProvidedBySupervisedEntity) {
    return decision(input, "MANUAL_BOUNDARY_REVIEW", "manual_review_required", [
      "The facts suggest other third-party procurement rather than classic outsourcing.",
      "Manual review is required to confirm the organisational-risk treatment and any residual governance requirements.",
    ], ["confirm-third-party-boundary"], sourceBasis, evidenceRefs);
  }

  return decision(input, "MANUAL_BOUNDARY_REVIEW", "manual_review_required", [
    "The arrangement does not meet the deterministic DORA or MaRisk routing rules.",
  ], ["confirm-outsourcing-boundary"], sourceBasis, evidenceRefs);
}

function missingCoreFacts(input: DoraMariskTriageInput): string[] {
  const blockers: string[] = [];
  if (!input.arrangementId.trim()) {
    blockers.push("missing-arrangement-id");
  }
  if (!input.serviceDescription.trim()) {
    blockers.push("missing-service-description");
  }
  if (input.isIctService === undefined) {
    blockers.push("missing-ict-service-classification");
  }
  if (input.isIctService === false && input.wouldOtherwiseBePerformedByInstitution === undefined) {
    blockers.push("missing-outsourcing-substitution-fact");
  }
  return blockers;
}

function decision(
  input: DoraMariskTriageInput,
  route: TriageRoute,
  reviewState: DoraMariskTriageDecision["reviewState"],
  rationale: string[],
  blockers: string[],
  sourceBasis: string[],
  evidenceRefs: string[],
): DoraMariskTriageDecision {
  return {
    schema: "dora-workbench.dora-marisk-triage.v1",
    arrangementId: input.arrangementId,
    route,
    reviewState,
    rationale,
    blockers,
    sourceBasis,
    evidenceRefs,
    reviewNotice:
      "This deterministic routing proof is a triage aid. It does not replace legal review of the final facts, contract, institution type, or current supervisory text.",
  };
}
