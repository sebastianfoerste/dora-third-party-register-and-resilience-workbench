import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export async function GET() {
  try {
    const vendors = await prisma.vendor.findMany({
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

    return NextResponse.json({ success: true, vendors });
  } catch (error: unknown) {
    console.error("GET outreach vendors error:", error);
    return NextResponse.json({ error: "Failed to load vendor communication draft data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { vendorId } = body;

    if (!vendorId) {
      return NextResponse.json({ error: "Vendor ID is required." }, { status: 400 });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Find all OPEN remediation tasks associated with this vendor's contract findings.
    const openTasks = await prisma.remediationTask.findMany({
      where: {
        status: "OPEN",
        finding: {
          contract: {
            vendorId,
          },
        },
      },
    });

    // Move tasks into a visible review workflow after the draft has been reviewed.
    if (openTasks.length > 0) {
      await prisma.remediationTask.updateMany({
        where: {
          id: { in: openTasks.map((t) => t.id) },
        },
        data: {
          status: "IN_PROGRESS",
        },
      });
    }

    // Log this internal compliance action in the audit trail.
    await prisma.auditLog.create({
      data: {
        actor: "Chief Compliance Officer",
        action: "VENDOR_REMEDIATION_DRAFT_LOGGED",
        object: `Vendor:${vendor.id}`,
        afterSnapshot: JSON.stringify({
          vendorName: vendor.legalName,
          updatedTasksCount: openTasks.length,
          taskIds: openTasks.map((t) => t.id),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      updatedTasksCount: openTasks.length,
      message: `Logged reviewed vendor remediation draft and transitioned ${openTasks.length} task(s) to IN_PROGRESS.`
    });
  } catch (error: unknown) {
    console.error("POST outreach error:", error);
    return NextResponse.json({ error: "Failed to process vendor remediation draft event" }, { status: 500 });
  }
}
