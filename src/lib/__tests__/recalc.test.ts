import { vi, describe, it, expect, beforeEach } from "vitest";
import { recalculateAllRegisters } from "../recalc";
import { prisma } from "../prisma";

// Mock the prisma module
vi.mock("../prisma", () => {
  return {
    prisma: {
      policySetting: {
        findMany: vi.fn(),
      },
      registerEntry: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    },
  };
});

describe("recalculateAllRegisters", () => {
  type RegisterEntries = Awaited<ReturnType<typeof prisma.registerEntry.findMany>>;
  type RegisterEntryUpdate = Awaited<ReturnType<typeof prisma.registerEntry.update>>;
  type AuditLogCreate = Awaited<ReturnType<typeof prisma.auditLog.create>>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load settings, validate each register entry, and save validation results", async () => {
    // 1. Mock policy settings
    vi.mocked(prisma.policySetting.findMany).mockResolvedValue([
      { id: "1", key: "enforce_eea_data_residency", value: "true", description: null, updatedAt: new Date() },
      { id: "2", key: "enforce_eu_governing_law", value: "false", description: null, updatedAt: new Date() },
      { id: "3", key: "enforce_exit_plan_for_critical_services", value: "true", description: null, updatedAt: new Date() },
    ]);

    // 2. Mock register entry data
    const mockRegisterEntry = {
      id: "entry-123",
      criticality: "CRITICAL",
      nextReviewDue: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
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
        id: "service-123",
        serviceDescription: "ERP Systems",
        supportedFunction: "Financial Reporting support",
        location: "Germany",
        subcontractingStatus: "NO",
        subcontractorDetails: null,
        substitutability: "DIFFICULT",
        exitPlanStatus: "APPROVED",
        resilienceTests: [],
      },
      contract: {
        id: "contract-123",
        sourceFile: "sap-master.pdf",
        effectiveDate: new Date(),
        renewalDate: new Date(),
        terminationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        governingLaw: "Germany",
        clauseFindings: [
          {
            requirementId: "dora-art-30-2-a",
            status: "PRESENT",
            requirement: { requirementName: "Description", severity: "HIGH" },
          },
        ],
      },
    };

    vi.mocked(prisma.registerEntry.findMany).mockResolvedValue([mockRegisterEntry] as unknown as RegisterEntries);
    vi.mocked(prisma.registerEntry.update).mockResolvedValue({} as RegisterEntryUpdate);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as AuditLogCreate);

    // Run the recalculation script
    await recalculateAllRegisters();

    // Verify policies loaded
    expect(prisma.policySetting.findMany).toHaveBeenCalled();

    // Verify entries fetched
    expect(prisma.registerEntry.findMany).toHaveBeenCalled();

    // Verify registry entry update is called
    expect(prisma.registerEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "entry-123" },
        data: expect.objectContaining({
          validationStatus: expect.any(String),
          validationErrors: expect.any(String),
        }),
      })
    );

    // Verify audit log entry is saved
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actor: "System Engine",
          action: "RECALCULATE_REGISTRY_COMPLIANCE",
        }),
      })
    );
  });
});
