import { vi, describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "../../app/api/outreach/route";
import { prisma } from "../prisma";

// Mock the prisma module
vi.mock("../prisma", () => {
  return {
    prisma: {
      vendor: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      remediationTask: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    },
  };
});

describe("Outreach API Route", () => {
  type Vendors = Awaited<ReturnType<typeof prisma.vendor.findMany>>;
  type Vendor = Awaited<ReturnType<typeof prisma.vendor.findUnique>>;
  type RemediationTasks = Awaited<ReturnType<typeof prisma.remediationTask.findMany>>;
  type RemediationTaskUpdate = Awaited<ReturnType<typeof prisma.remediationTask.updateMany>>;
  type AuditLogCreate = Awaited<ReturnType<typeof prisma.auditLog.create>>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("should fetch all vendors with contracts, findings, and services", async () => {
      const mockVendors = [
        { id: "v1", legalName: "Vendor A", contracts: [], services: [] },
        { id: "v2", legalName: "Vendor B", contracts: [], services: [] },
      ];

      vi.mocked(prisma.vendor.findMany).mockResolvedValue(mockVendors as unknown as Vendors);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.vendors).toEqual(mockVendors);
      expect(prisma.vendor.findMany).toHaveBeenCalledWith({
        include: {
          contracts: {
            include: {
              clauseFindings: {
                include: {
                  requirement: true,
                },
              },
            },
          },
          services: true,
        },
        orderBy: {
          legalName: "asc",
        },
      });
    });
  });

  describe("POST", () => {
    it("should return 400 if vendorId is missing", async () => {
      const req = new Request("http://localhost/api/outreach", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Vendor ID is required.");
    });

    it("should return 404 if vendor does not exist", async () => {
      vi.mocked(prisma.vendor.findUnique).mockResolvedValue(null);

      const req = new Request("http://localhost/api/outreach", {
        method: "POST",
        body: JSON.stringify({ vendorId: "non-existent" }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Vendor not found");
    });

    it("should transition open remediation tasks to IN_PROGRESS and log audit entry", async () => {
      const mockVendor = { id: "vendor-123", legalName: "Solaris SE" };
      const mockOpenTasks = [
        { id: "task-1", status: "OPEN" },
        { id: "task-2", status: "OPEN" },
      ];

      vi.mocked(prisma.vendor.findUnique).mockResolvedValue(mockVendor as Vendor);
      vi.mocked(prisma.remediationTask.findMany).mockResolvedValue(mockOpenTasks as RemediationTasks);
      vi.mocked(prisma.remediationTask.updateMany).mockResolvedValue({ count: 2 } as RemediationTaskUpdate);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as AuditLogCreate);

      const req = new Request("http://localhost/api/outreach", {
        method: "POST",
        body: JSON.stringify({ vendorId: "vendor-123" }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.updatedTasksCount).toBe(2);

      // Verify DB interactions
      expect(prisma.vendor.findUnique).toHaveBeenCalledWith({ where: { id: "vendor-123" } });
      expect(prisma.remediationTask.findMany).toHaveBeenCalledWith({
        where: {
          status: "OPEN",
          finding: {
            contract: {
              vendorId: "vendor-123",
            },
          },
        },
      });
      expect(prisma.remediationTask.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["task-1", "task-2"] } },
        data: { status: "IN_PROGRESS" },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actor: "Chief Compliance Officer",
            action: "VENDOR_REMEDIATION_DRAFT_LOGGED",
            object: "Vendor:vendor-123",
          }),
        })
      );
    });
  });
});
