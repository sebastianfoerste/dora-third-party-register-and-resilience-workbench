export interface RegisterVendorInput {
  id: string;
  name: string;
  hasLegalEntity: boolean;
  serviceCount: number;
  criticality: "CRITICAL" | "IMPORTANT" | "NON_CRITICAL" | null;
}

export interface RegisterContractInput {
  id: string;
  vendorId: string;
  hasRegisterEntry: boolean;
  missingHighSeverityFindings: number;
}

export interface RegisterWorkflowStep {
  id: "vendor-index" | "criticality" | "clause-coverage" | "register-entries" | "roi-export-gate";
  label: string;
  status: "complete" | "blocked" | "pending_review";
  evidenceRefs: string[];
  blocker: string | null;
}

export interface RegisterWorkflowRun {
  schema: "dora.register-workflow.v1";
  runId: string;
  status: "blocked" | "awaiting_review" | "ready_for_review";
  steps: RegisterWorkflowStep[];
  roiExportAllowed: boolean;
  externalDeliveryAllowed: false;
}

export function runRegisterWorkflow(input: {
  runId: string;
  vendors: RegisterVendorInput[];
  contracts: RegisterContractInput[];
  reviewerApproved: boolean;
}): RegisterWorkflowRun {
  const brokenVendors = input.vendors.filter(
    (vendor) => !vendor.hasLegalEntity || vendor.serviceCount === 0,
  );
  const unassessed = input.vendors.filter((vendor) => vendor.criticality === null);
  const missingHigh = input.contracts.reduce(
    (sum, contract) => sum + contract.missingHighSeverityFindings,
    0,
  );
  const unregistered = input.contracts.filter((contract) => !contract.hasRegisterEntry);

  const preSteps: RegisterWorkflowStep[] = [
    {
      id: "vendor-index",
      label: "Index vendors, legal entities and ICT services",
      status: brokenVendors.length > 0 ? "blocked" : "complete",
      evidenceRefs: input.vendors.map((vendor) => `vendor:${vendor.id}`),
      blocker:
        brokenVendors.length > 0
          ? `Incomplete vendor records: ${brokenVendors.slice(0, 5).map((vendor) => vendor.name).join(", ")}.`
          : null,
    },
    {
      id: "criticality",
      label: "Criticality assessment per vendor",
      status: unassessed.length > 0 ? "blocked" : "complete",
      evidenceRefs: input.vendors
        .filter((vendor) => vendor.criticality !== null)
        .map((vendor) => `criticality:${vendor.id}:${vendor.criticality}`),
      blocker:
        unassessed.length > 0
          ? `${unassessed.length} vendor(s) without a criticality assessment.`
          : null,
    },
    {
      id: "clause-coverage",
      label: "HIGH-severity clause coverage",
      status: missingHigh > 0 ? "blocked" : "complete",
      evidenceRefs: input.contracts.map((contract) => `contract:${contract.id}`),
      blocker:
        missingHigh > 0
          ? `${missingHigh} missing HIGH-severity clause finding(s) across the contract base.`
          : null,
    },
    {
      id: "register-entries",
      label: "Register entries per contract",
      status: unregistered.length > 0 ? "blocked" : "complete",
      evidenceRefs: input.contracts
        .filter((contract) => contract.hasRegisterEntry)
        .map((contract) => `register-entry:${contract.id}`),
      blocker:
        unregistered.length > 0
          ? `${unregistered.length} contract(s) without a register entry.`
          : null,
    },
  ];

  const anyBlocked = preSteps.some((step) => step.status === "blocked");
  const gate: RegisterWorkflowStep = {
    id: "roi-export-gate",
    label: "Reviewer decision before RoI export",
    status: !input.reviewerApproved ? "pending_review" : anyBlocked ? "blocked" : "complete",
    evidenceRefs: [],
    blocker: !input.reviewerApproved
      ? "A documented reviewer decision is required before the register of information leaves the workbench."
      : anyBlocked
        ? "Upstream steps are blocked; approval alone does not open the export."
        : null,
  };

  const steps = [...preSteps, gate];
  const blocked = steps.some((step) => step.status === "blocked");
  const awaiting = !blocked && steps.some((step) => step.status === "pending_review");

  return {
    schema: "dora.register-workflow.v1",
    runId: input.runId,
    status: blocked ? "blocked" : awaiting ? "awaiting_review" : "ready_for_review",
    steps,
    roiExportAllowed: steps.every((step) => step.status === "complete"),
    externalDeliveryAllowed: false,
  };
}
