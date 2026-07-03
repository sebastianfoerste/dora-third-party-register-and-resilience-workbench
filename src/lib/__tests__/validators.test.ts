import { describe, it, expect } from "vitest";
import { validateLEI, validateRegisterEntry } from "../validators";

describe("validateLEI", () => {
  it("should validate correct 20-character LEI strings", () => {
    expect(validateLEI("12345678901234567890")).toBe(true);
    expect(validateLEI("ABCDEFGHIJKLMNOPQRST")).toBe(true);
  });

  it("should fail validation for incorrect lengths or special characters", () => {
    expect(validateLEI(null)).toBe(false);
    expect(validateLEI("")).toBe(false);
    expect(validateLEI("1234567890")).toBe(false); // too short
    expect(validateLEI("123456789012345678901")).toBe(false); // too long
    expect(validateLEI("1234567890123456789*")).toBe(false); // special char
  });
});

describe("validateRegisterEntry", () => {
  const baseData = {
    legalEntity: {
      name: "Solaris SE",
      lei: "12345678901234567890",
      jurisdiction: "DE",
      licenceType: "CREDIT_INSTITUTION",
    },
    vendor: {
      legalName: "SAP SE",
      country: "DE",
      lei: "20QWERTYUIOPASDFGHJK",
    },
    service: {
      serviceDescription: "Cloud infrastructure",
      supportedFunction: "Core Banking Support",
      location: "Germany",
      subcontractingStatus: "NO",
      subcontractorDetails: null,
      substitutability: "DIFFICULT",
      exitPlanStatus: "APPROVED",
    },
    contract: {
      sourceFile: "sap-agreement.pdf",
      effectiveDate: new Date(),
      renewalDate: new Date(),
      terminationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year in future
      governingLaw: "Germany",
    },
    findings: [
      { requirementId: "dora-art-30-2-a", requirementName: "Description", status: "PRESENT", severity: "HIGH" },
      { requirementId: "dora-art-30-2-b", requirementName: "Data Location", status: "PRESENT", severity: "HIGH" },
      { requirementId: "dora-art-30-2-c", requirementName: "Data Protection", status: "PRESENT", severity: "HIGH" },
      { requirementId: "dora-art-30-2-d", requirementName: "SLAs", status: "PRESENT", severity: "HIGH" },
      { requirementId: "dora-art-30-2-e", requirementName: "Incident Reporting", status: "PRESENT", severity: "HIGH" },
      { requirementId: "dora-art-30-2-f", requirementName: "Audit Rights", status: "PRESENT", severity: "HIGH" },
      { requirementId: "dora-art-30-2-g", requirementName: "Termination", status: "PRESENT", severity: "HIGH" },
      { requirementId: "dora-art-30-2-h", requirementName: "Exit Plan", status: "PRESENT", severity: "HIGH" },
      { requirementId: "dora-art-30-2-i", requirementName: "Subcontracting Approval", status: "PRESENT", severity: "HIGH" },
    ],
    criticality: "CRITICAL" as const,
    nextReviewDue: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000), // 100 days in future
    resilienceTests: [
      {
        testType: "DR Scenario",
        testDate: new Date(),
        status: "PASSED",
        findingsCount: 0,
        evidenceSummary: "Drill completed successfully without findings",
      },
    ],
  };

  it("should score a fully compliant entry highly", () => {
    const result = validateRegisterEntry(baseData);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.errors.filter(e => e.severity === "HIGH")).toHaveLength(0);
  });

  it("should detect missing LEI details and reduce compliance score", () => {
    const brokenData = {
      ...baseData,
      legalEntity: { ...baseData.legalEntity, lei: null },
    };
    const result = validateRegisterEntry(brokenData);
    expect(result.score).toBeLessThan(100);
    expect(result.errors.some(e => e.id === "le-lei-missing")).toBe(true);
  });

  it("should trigger warnings for missing exit plans under strict exit policies", () => {
    const draftExitData = {
      ...baseData,
      service: { ...baseData.service, exitPlanStatus: "NONE" },
    };
    const result = validateRegisterEntry(draftExitData);
    expect(result.errors.some(e => e.id === "critical-no-exit-plan")).toBe(true);
  });

  it("should detect non-EEA data residency when strictly enforced", () => {
    const nonEEAData = {
      ...baseData,
      service: { ...baseData.service, location: "US-EAST-1" },
    };
    const result = validateRegisterEntry(nonEEAData, { enforceEEADataResidency: true });
    expect(result.errors.some(e => e.id === "service-location-non-eea")).toBe(true);
  });

  it("should detect missing contract clauses and report them as clause gaps", () => {
    const missingClausesData = {
      ...baseData,
      findings: baseData.findings.map(f =>
        f.requirementId === "dora-art-30-2-f" ? { ...f, status: "MISSING" } : f
      ),
    };
    const result = validateRegisterEntry(missingClausesData);
    expect(result.errors.some(e => e.id === "missing-high-clauses")).toBe(true);
  });

  it("should block critical services that lack resilience testing evidence", () => {
    const result = validateRegisterEntry({
      ...baseData,
      resilienceTests: [],
    });

    expect(result.status).toBe("INVALID");
    expect(result.errors.some(e => e.id === "critical-no-resilience-testing")).toBe(true);
  });

  it("should flag overdue annual register reviews", () => {
    const result = validateRegisterEntry({
      ...baseData,
      nextReviewDue: new Date("2026-01-15T00:00:00.000Z"),
    });

    expect(result.errors.some(e => e.id === "register-annual-review-overdue")).toBe(true);
  });

  it("should treat non-EU governing law as high risk when strict law policy is active", () => {
    const result = validateRegisterEntry(
      {
        ...baseData,
        contract: { ...baseData.contract, governingLaw: "New York" },
      },
      { enforceEUGoverningLaw: true },
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: "governing-law-non-eu",
        severity: "HIGH",
      }),
    );
  });

  it("should require subcontractor details when subcontracting is used", () => {
    const result = validateRegisterEntry({
      ...baseData,
      service: {
        ...baseData.service,
        subcontractingStatus: "YES",
        subcontractorDetails: "",
      },
    });

    expect(result.errors.some(e => e.id === "subcontractor-details-missing")).toBe(true);
  });
});
