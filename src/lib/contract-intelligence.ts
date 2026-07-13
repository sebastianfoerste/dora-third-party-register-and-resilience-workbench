export type VaultDocumentKind = "agreement" | "addendum" | "exit_plan" | "evidence";
export type ReviewStatus = "pass" | "review" | "missing";
export type WorkflowStepStatus = "complete" | "blocked" | "pending_review";

export interface ContractVaultDocumentInput {
  id: string;
  vendorId: string;
  vendorName: string;
  title: string;
  kind: VaultDocumentKind;
  sourceRef: string;
  sourceStatus: "verified" | "fixture" | "stale";
  clauses: Record<string, string | undefined>;
}

export interface ContractVault {
  schema: "dora.contract-vault.v1";
  matterId: string;
  name: string;
  accessMode: "internal_review";
  documents: ContractVaultDocumentInput[];
  vendorCount: number;
  documentCount: number;
  staleSourceCount: number;
  externalSharingAllowed: false;
}

export interface ClausePlaybookColumn {
  id: string;
  label: string;
  citation: string;
  required: boolean;
}

export interface ClauseReviewCell {
  columnId: string;
  status: ReviewStatus;
  value: string;
  citation: string;
  sourceRef: string;
  reviewerNote: string | null;
}

export interface ClauseReviewRow {
  documentId: string;
  vendorName: string;
  documentTitle: string;
  cells: ClauseReviewCell[];
  blockerCount: number;
}

export interface ClauseReviewTable {
  schema: "dora.clause-review-table.v1";
  instructions: string;
  columns: ClausePlaybookColumn[];
  rows: ClauseReviewRow[];
  blockerCount: number;
  requiresHumanReview: true;
}

export interface RemediationWorkflowStep {
  id: string;
  label: string;
  status: WorkflowStepStatus;
  owner: string;
  evidenceRefs: string[];
  blocker: string | null;
}

export interface RemediationWorkflowRun {
  schema: "dora.remediation-workflow.v1";
  runId: string;
  matterId: string;
  status: "blocked" | "awaiting_review" | "ready_for_review";
  steps: RemediationWorkflowStep[];
  draftBoardPackAllowed: boolean;
  externalDeliveryAllowed: false;
  nextAction: string;
}

export function buildContractVault(input: {
  matterId: string;
  name: string;
  documents: ContractVaultDocumentInput[];
}): ContractVault {
  const documentIds = new Set<string>();
  for (const document of input.documents) {
    if (documentIds.has(document.id)) {
      throw new Error(`Duplicate contract vault document id: ${document.id}`);
    }
    if (!document.sourceRef.trim()) {
      throw new Error(`Contract vault document ${document.id} is missing source provenance.`);
    }
    documentIds.add(document.id);
  }

  return {
    schema: "dora.contract-vault.v1",
    matterId: input.matterId,
    name: input.name,
    accessMode: "internal_review",
    documents: input.documents,
    vendorCount: new Set(input.documents.map((document) => document.vendorId)).size,
    documentCount: input.documents.length,
    staleSourceCount: input.documents.filter((document) => document.sourceStatus === "stale").length,
    externalSharingAllowed: false,
  };
}

export function buildClauseReviewTable(
  vault: ContractVault,
  columns: ClausePlaybookColumn[],
): ClauseReviewTable {
  if (columns.length === 0) {
    throw new Error("The DORA clause playbook requires at least one review column.");
  }

  const rows = vault.documents
    .filter((document) => document.kind === "agreement" || document.kind === "addendum")
    .map((document) => {
      const cells = columns.map((column): ClauseReviewCell => {
        const extracted = document.clauses?.[column.id]?.trim();
        const status: ReviewStatus = extracted
          ? document.sourceStatus === "stale"
            ? "review"
            : "pass"
          : column.required
            ? "missing"
            : "review";
        return {
          columnId: column.id,
          status,
          value: extracted || "No supported clause found in the indexed document.",
          citation: column.citation,
          sourceRef: document.sourceRef,
          reviewerNote: null,
        };
      });
      return {
        documentId: document.id,
        vendorName: document.vendorName,
        documentTitle: document.title,
        cells,
        blockerCount: cells.filter((cell) => cell.status === "missing").length,
      };
    });

  return {
    schema: "dora.clause-review-table.v1",
    instructions:
      "Apply the approved DORA contract playbook consistently. Preserve source references and route every missing clause to human review.",
    columns,
    rows,
    blockerCount: rows.reduce((total, row) => total + row.blockerCount, 0),
    requiresHumanReview: true,
  };
}

export function runRemediationWorkflow(input: {
  runId: string;
  vault: ContractVault;
  reviewTable: ClauseReviewTable;
  owner: string;
  reviewerApproved: boolean;
}): RemediationWorkflowRun {
  const missingCells = input.reviewTable.rows.flatMap((row) =>
    row.cells
      .filter((cell) => cell.status === "missing")
      .map((cell) => ({ row, cell })),
  );
  const staleSources = input.vault.documents.filter((document) => document.sourceStatus === "stale");

  const steps: RemediationWorkflowStep[] = [
    {
      id: "index-vault",
      label: "Index contract vault",
      status: "complete",
      owner: input.owner,
      evidenceRefs: input.vault.documents.map((document) => document.sourceRef),
      blocker: null,
    },
    {
      id: "apply-playbook",
      label: "Apply DORA clause playbook",
      status: missingCells.length > 0 ? "blocked" : "complete",
      owner: input.owner,
      evidenceRefs: missingCells.map(({ cell }) => cell.sourceRef),
      blocker:
        missingCells.length > 0
          ? `${missingCells.length} required clause review cells remain missing.`
          : null,
    },
    {
      id: "verify-sources",
      label: "Verify source freshness",
      status: staleSources.length > 0 ? "blocked" : "complete",
      owner: input.owner,
      evidenceRefs: staleSources.map((document) => document.sourceRef),
      blocker:
        staleSources.length > 0
          ? `${staleSources.length} indexed documents require source refresh.`
          : null,
    },
    {
      id: "legal-review",
      label: "Record legal reviewer decision",
      status: input.reviewerApproved ? "complete" : "pending_review",
      owner: "Legal reviewer",
      evidenceRefs: [],
      blocker: input.reviewerApproved ? null : "A documented legal review decision is required.",
    },
  ];

  const blocked = steps.some((step) => step.status === "blocked");
  const awaitingReview = !blocked && steps.some((step) => step.status === "pending_review");
  return {
    schema: "dora.remediation-workflow.v1",
    runId: input.runId,
    matterId: input.vault.matterId,
    status: blocked ? "blocked" : awaitingReview ? "awaiting_review" : "ready_for_review",
    steps,
    draftBoardPackAllowed: !blocked && input.reviewerApproved,
    externalDeliveryAllowed: false,
    nextAction: blocked
      ? "Resolve missing clauses and stale sources, then rerun the workflow."
      : awaitingReview
        ? "Record the legal reviewer decision."
        : "Inspect the draft board pack and keep delivery behind the existing approval gate.",
  };
}

export function buildDemoContractIntelligenceWorkspace() {
  const vault = buildContractVault({
    matterId: "matter-synthetic-cloud",
    name: "Synthetic Critical Cloud Provider Review",
    documents: [
      {
        id: "doc-master-services",
        vendorId: "vendor-northstar",
        vendorName: "Northstar Cloud (synthetic)",
        title: "Master services agreement",
        kind: "agreement",
        sourceRef: "fixture://contracts/northstar-msa",
        sourceStatus: "fixture",
        clauses: {
          audit_rights: "The financial entity may audit the provider and its material subcontractors.",
          exit_assistance: "The provider will support an orderly transition for 90 days.",
        },
      },
      {
        id: "doc-security-addendum",
        vendorId: "vendor-northstar",
        vendorName: "Northstar Cloud (synthetic)",
        title: "Security addendum",
        kind: "addendum",
        sourceRef: "fixture://contracts/northstar-security-addendum",
        sourceStatus: "fixture",
        clauses: {
          incident_notice: "Material ICT incidents must be notified without undue delay.",
        },
      },
      {
        id: "doc-exit-plan",
        vendorId: "vendor-northstar",
        vendorName: "Northstar Cloud (synthetic)",
        title: "Exit plan evidence",
        kind: "exit_plan",
        sourceRef: "fixture://exit-plans/northstar",
        sourceStatus: "fixture",
        clauses: {},
      },
    ],
  });
  const reviewTable = buildClauseReviewTable(vault, [
    { id: "audit_rights", label: "Audit rights", citation: "DORA Article 30(2)", required: true },
    { id: "incident_notice", label: "Incident notice", citation: "DORA Article 30(2)", required: true },
    { id: "exit_assistance", label: "Exit assistance", citation: "DORA Article 30(3)", required: true },
  ]);
  const workflow = runRemediationWorkflow({
    runId: "run-synthetic-cloud",
    vault,
    reviewTable,
    owner: "ICT Third-Party Risk",
    reviewerApproved: false,
  });
  return { vault, reviewTable, workflow };
}
