export interface ValidationError {
  id: string;
  field: string;
  message: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  type: "DATA_GAP" | "CLAUSE_GAP" | "RISK";
}

export interface ValidationResult {
  status: "VALID" | "WARNING" | "INVALID";
  score: number; // 0 to 100
  errors: ValidationError[];
}

export function validateLEI(lei: string | null): boolean {
  if (!lei) return false;
  return /^[A-Z0-9]{20}$/.test(lei.trim().toUpperCase());
}

export function validateRegisterEntry(data: {
  legalEntity: { name: string; lei: string | null; jurisdiction: string; licenceType: string };
  vendor: { legalName: string; country: string; lei: string | null };
  service: {
    serviceDescription: string;
    supportedFunction: string;
    location: string;
    subcontractingStatus: string;
    subcontractorDetails: string | null;
    substitutability: string;
    exitPlanStatus: string;
  };
  contract: {
    sourceFile: string;
    effectiveDate: Date | null;
    renewalDate: Date | null;
    terminationDate: Date | null;
    governingLaw: string;
  } | null;
  findings: Array<{
    requirementId: string;
    requirementName: string;
    status: string;
    severity: string;
  }>;
  criticality: "CRITICAL" | "IMPORTANT" | "NON_CRITICAL";
}): ValidationResult {
  const errors: ValidationError[] = [];
  let totalChecks = 12;
  let passedChecks = 12;

  const { legalEntity, vendor, service, contract, findings, criticality } = data;

  // 1. Legal Entity Checks
  if (!legalEntity.lei) {
    errors.push({
      id: "le-lei-missing",
      field: "legalEntity.lei",
      message: `Legal Entity (${legalEntity.name}) lacks a Legal Entity Identifier (LEI).`,
      severity: "MEDIUM",
      type: "DATA_GAP",
    });
    passedChecks -= 0.5;
  } else if (!validateLEI(legalEntity.lei)) {
    errors.push({
      id: "le-lei-invalid",
      field: "legalEntity.lei",
      message: `Legal Entity (${legalEntity.name}) LEI (${legalEntity.lei}) is invalid. Must be exactly 20 uppercase alphanumeric characters under ISO 17442.`,
      severity: "HIGH",
      type: "DATA_GAP",
    });
    passedChecks -= 1.0;
  }

  // 2. Vendor Checks
  if (!vendor.lei) {
    errors.push({
      id: "vendor-lei-missing",
      field: "vendor.lei",
      message: `Vendor (${vendor.legalName}) lacks an LEI. Required for supervisor registers.`,
      severity: "MEDIUM",
      type: "DATA_GAP",
    });
    passedChecks -= 0.5;
  } else if (!validateLEI(vendor.lei)) {
    errors.push({
      id: "vendor-lei-invalid",
      field: "vendor.lei",
      message: `Vendor (${vendor.legalName}) LEI (${vendor.lei}) is invalid. Must be exactly 20 uppercase alphanumeric characters under ISO 17442.`,
      severity: "HIGH",
      type: "DATA_GAP",
    });
    passedChecks -= 1.0;
  }

  // 3. Service Location
  if (!service.location) {
    errors.push({
      id: "service-location-missing",
      field: "service.location",
      message: "Data storage or processing location is not specified.",
      severity: "HIGH",
      type: "DATA_GAP",
    });
    passedChecks -= 1.0;
  }

  // 4. Criticality Exit Plan Check
  const isCriticalOrImportant = criticality === "CRITICAL" || criticality === "IMPORTANT";
  if (isCriticalOrImportant && (!service.exitPlanStatus || service.exitPlanStatus === "NONE")) {
    errors.push({
      id: "critical-no-exit-plan",
      field: "service.exitPlanStatus",
      message: `Service supporting '${service.supportedFunction}' is classified as ${criticality} but has no Exit Plan.`,
      severity: "HIGH",
      type: "RISK",
    });
    passedChecks -= 1.5;
  }

  // 5. Subcontracting Checks
  if (
    (service.subcontractingStatus === "YES" || service.subcontractingStatus === "MIXED") &&
    (!service.subcontractorDetails || service.subcontractorDetails.trim() === "")
  ) {
    errors.push({
      id: "subcontractor-details-missing",
      field: "service.subcontractorDetails",
      message: "Service uses subcontracting but no subcontractor names or locations are provided.",
      severity: "MEDIUM",
      type: "DATA_GAP",
    });
    passedChecks -= 0.8;
  }

  // 6. Contract Checks
  if (!contract) {
    errors.push({
      id: "contract-missing",
      field: "contract",
      message: "No contract is uploaded or mapped to this register entry.",
      severity: "HIGH",
      type: "DATA_GAP",
    });
    passedChecks -= 2.5;
  } else {
    // 7. Governing Law Check (EU DORA Wedge)
    const euCountries = ["DE", "FR", "IE", "NL", "LU", "BE", "IT", "ES", "PT", "AT", "DK", "SE", "FI", "PL", "GR", "CZ", "HU", "RO", "BG", "HR", "SK", "SI", "EE", "LV", "LT", "CY", "MT", "GERMANY", "FRANCE", "IRELAND", "NETHERLANDS", "EU", "EUROPEAN UNION"];
    const law = contract.governingLaw.toUpperCase();
    const isEULaw = euCountries.some((country) => law.includes(country));
    if (!isEULaw && law !== "") {
      errors.push({
        id: "governing-law-non-eu",
        field: "contract.governingLaw",
        message: `Contract governing law (${contract.governingLaw}) may be outside the EU. DORA requires aligning jurisdiction.`,
        severity: "LOW",
        type: "RISK",
      });
      passedChecks -= 0.4;
    }

    // 8. Contract Expiry Check (within 90 days)
    if (contract.terminationDate) {
      const today = new Date();
      const expiry = new Date(contract.terminationDate);
      const diffTime = expiry.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 90) {
        errors.push({
          id: "contract-expiry-imminent",
          field: "contract.terminationDate",
          message: `Contract is expiring in ${diffDays} days (${expiry.toLocaleDateString()}). Mapped risk requires review.`,
          severity: "MEDIUM",
          type: "RISK",
        });
        passedChecks -= 0.8;
      }
    }
  }

  // 9. Clause findings check
  if (findings && findings.length > 0) {
    const missingHigh = findings.filter(
      (f) => f.status === "MISSING" && f.severity === "HIGH"
    );
    const missingMedium = findings.filter(
      (f) => f.status === "MISSING" && f.severity === "MEDIUM"
    );

    if (missingHigh.length > 0) {
      errors.push({
        id: "missing-high-clauses",
        field: "findings",
        message: `${missingHigh.length} critical clause requirement(s) are missing from the contract (e.g. ${missingHigh.map(m => m.requirementName).slice(0, 2).join(", ")}).`,
        severity: "HIGH",
        type: "CLAUSE_GAP",
      });
      passedChecks -= 2.0;
    }

    if (missingMedium.length > 0) {
      errors.push({
        id: "missing-medium-clauses",
        field: "findings",
        message: `${missingMedium.length} medium-severity clause requirement(s) are missing from the contract.`,
        severity: "MEDIUM",
        type: "CLAUSE_GAP",
      });
      passedChecks -= 1.0;
    }
  } else if (contract) {
    errors.push({
      id: "clauses-unreviewed",
      field: "findings",
      message: "DORA clause compliance gap analysis has not been run or reviewed for this contract.",
      severity: "HIGH",
      type: "CLAUSE_GAP",
    });
    passedChecks -= 1.5;
  }

  // Calculate score between 0 and 100
  let score = Math.round((Math.max(0, passedChecks) / totalChecks) * 100);

  // Status mapping
  let status: "VALID" | "WARNING" | "INVALID" = "VALID";
  if (errors.some((e) => e.severity === "HIGH")) {
    status = "INVALID";
  } else if (errors.some((e) => e.severity === "MEDIUM" || e.severity === "LOW")) {
    status = "WARNING";
  }

  return {
    status,
    score,
    errors,
  };
}
