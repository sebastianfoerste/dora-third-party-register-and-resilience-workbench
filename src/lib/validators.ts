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

export function validateRegisterEntry(
  data: {
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
    nextReviewDue?: Date | string | null;
    resilienceTests?: Array<{
      testType: string;
      testDate: Date | string;
      status: string;
      findingsCount: number;
      evidenceSummary: string;
    }>;
  },
  options?: {
    enforceEEADataResidency?: boolean;
    enforceEUGoverningLaw?: boolean;
    enforceExitPlan?: boolean;
  }
 ): ValidationResult {
  const errors: ValidationError[] = [];
  const totalChecks = 15;
  let passedChecks = 15;
 
  const { legalEntity, vendor, service, contract, findings, criticality, nextReviewDue, resilienceTests } = data;
 
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
  } else {
    const enforceEEA = options?.enforceEEADataResidency !== false;
    if (enforceEEA) {
      const nonEEAKeywords = ["US", "USA", "AMERICA", "ISRAEL", "IL", "UK", "LONDON", "GREAT BRITAIN", "SWITZERLAND", "CH", "NEW YORK", "TEL AVIV"];
      const locUpper = service.location.toUpperCase();
      const isNonEEA = nonEEAKeywords.some((k) => locUpper.includes(k));
      if (isNonEEA) {
        errors.push({
          id: "service-location-non-eea",
          field: "service.location",
          message: `Data is stored or processed outside the EEA (${service.location}). Non-EEA data residency is restricted under active policy rules.`,
          severity: "HIGH",
          type: "RISK",
        });
        passedChecks -= 1.2;
      }
    }
  }
 
  // 4. Criticality Exit Plan Check
  const isCriticalOrImportant = criticality === "CRITICAL" || criticality === "IMPORTANT";
  const enforceExit = options?.enforceExitPlan !== false;
  if (isCriticalOrImportant) {
    if (!service.exitPlanStatus || service.exitPlanStatus === "NONE") {
      errors.push({
        id: "critical-no-exit-plan",
        field: "service.exitPlanStatus",
        message: `Service supporting '${service.supportedFunction}' is classified as ${criticality} but has no Exit Plan.`,
        severity: "HIGH",
        type: "RISK",
      });
      passedChecks -= 1.5;
    } else if (enforceExit && service.exitPlanStatus !== "APPROVED") {
      errors.push({
        id: "critical-exit-plan-unapproved",
        field: "service.exitPlanStatus",
        message: `Exit Plan for service supporting '${service.supportedFunction}' is in '${service.exitPlanStatus}' status. Active policy requires CCO-APPROVED exit plans.`,
        severity: "MEDIUM",
        type: "RISK",
      });
      passedChecks -= 0.8;
    }
  }

  // 4a. Resilience Testing Validation (DORA Article 24/25)
  if (isCriticalOrImportant) {
    const testList = resilienceTests || [];
    const passedTests = testList.filter((t) => t.status === "PASSED");
    const latestTest = testList.length > 0 
      ? [...testList].sort((a,b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())[0]
      : null;

    if (testList.length === 0) {
      errors.push({
        id: "critical-no-resilience-testing",
        field: "service.resilienceTests",
        message: `Service supporting '${service.supportedFunction}' is classified as ${criticality} but lacks recorded resilience testing evidence (DORA Article 24).`,
        severity: "HIGH",
        type: "RISK",
      });
      passedChecks -= 1.5;
    } else if (latestTest && latestTest.status === "FAILED") {
      errors.push({
        id: "critical-resilience-test-failed",
        field: "service.resilienceTests",
        message: `The latest resilience test (${latestTest.testType}) for service supporting '${service.supportedFunction}' on ${new Date(latestTest.testDate).toLocaleDateString()} FAILED with ${latestTest.findingsCount} findings.`,
        severity: "HIGH",
        type: "RISK",
      });
      passedChecks -= 1.8;
    } else {
      const latestPassed = passedTests.sort((a,b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())[0];
      if (latestPassed) {
        const today = new Date();
        const testDateObj = new Date(latestPassed.testDate);
        const testAgeDays = Math.ceil((today.getTime() - testDateObj.getTime()) / (1000 * 60 * 60 * 24));
        if (testAgeDays > 365) {
          errors.push({
            id: "critical-resilience-test-outdated",
            field: "service.resilienceTests",
            message: `Latest passed resilience test (${latestPassed.testType}) is outdated (${testAgeDays} days old). DORA Article 24 requires annual testing.`,
            severity: "MEDIUM",
            type: "RISK",
          });
          passedChecks -= 0.8;
        }
      } else {
        errors.push({
          id: "critical-no-passed-resilience-test",
          field: "service.resilienceTests",
          message: `Service supporting '${service.supportedFunction}' has no passed resilience testing evidence recorded.`,
          severity: "HIGH",
          type: "RISK",
        });
        passedChecks -= 1.5;
      }
    }
  }

  // 4b. Annual Review Validation (DORA Article 30)
  if (nextReviewDue) {
    const today = new Date();
    const due = new Date(nextReviewDue);
    if (due.getTime() < today.getTime()) {
      errors.push({
        id: "register-annual-review-overdue",
        field: "register.nextReviewDue",
        message: `Annual registry compliance review is overdue (was due on ${due.toLocaleDateString()}).`,
        severity: "HIGH",
        type: "RISK",
      });
      passedChecks -= 1.5;
    } else {
      const diffTime = due.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 30) {
        errors.push({
          id: "register-annual-review-imminent",
          field: "register.nextReviewDue",
          message: `Annual registry review is due in ${diffDays} days (${due.toLocaleDateString()}).`,
          severity: "MEDIUM",
          type: "RISK",
        });
        passedChecks -= 0.5;
      }
    }
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
    const enforceEU = options?.enforceEUGoverningLaw !== false;
    if (!isEULaw && law !== "") {
      errors.push({
        id: "governing-law-non-eu",
        field: "contract.governingLaw",
        message: `Contract governing law (${contract.governingLaw}) is outside the EU/EEA. DORA requires aligning jurisdiction.`,
        severity: enforceEU ? "HIGH" : "LOW",
        type: "RISK",
      });
      passedChecks -= enforceEU ? 1.2 : 0.4;
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
  const score = Math.round((Math.max(0, passedChecks) / totalChecks) * 100);

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
