import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalculateAllRegisters } from "@/lib/recalc";

export const revalidate = 0;

export async function GET() {
  try {
    // Get all services with exit plans
    const services = await prisma.iCTService.findMany({
      include: {
        vendor: true,
        exitPlan: true,
      },
    });
    return NextResponse.json({ success: true, services });
  } catch (error: unknown) {
    console.error("GET exit plans error:", error);
    return NextResponse.json({ error: "Failed to load exit strategies" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { serviceId, title, strategy, alternativeVendor, status, testedDate, reviewer } = body;

    if (!serviceId || !title || !strategy) {
      return NextResponse.json({ error: "Service, title, and strategy text are required." }, { status: 400 });
    }

    const parsedTestedDate = testedDate ? new Date(testedDate) : null;

    // Check if exit plan already exists
    const existing = await prisma.exitPlan.findUnique({
      where: { serviceId },
    });

    let exitPlan;
    if (existing) {
      exitPlan = await prisma.exitPlan.update({
        where: { serviceId },
        data: {
          title,
          strategy,
          alternativeVendor,
          status,
          testedDate: parsedTestedDate,
          reviewer,
        },
      });
    } else {
      exitPlan = await prisma.exitPlan.create({
        data: {
          serviceId,
          title,
          strategy,
          alternativeVendor,
          status,
          testedDate: parsedTestedDate,
          reviewer,
        },
      });
    }

    // Update the ICTService exitPlanStatus string
    await prisma.iCTService.update({
      where: { id: serviceId },
      data: {
        exitPlanStatus: status, // DRAFT, APPROVED, etc.
      },
    });

    // Revalidate compliance metrics across all register entries
    await recalculateAllRegisters();

    // Audit Log
    await prisma.auditLog.create({
      data: {
        actor: reviewer || "Compliance Auditor",
        action: existing ? "UPDATE_EXIT_PLAN" : "CREATE_EXIT_PLAN",
        object: `ExitPlan:${serviceId}`,
        afterSnapshot: JSON.stringify(exitPlan),
      },
    });

    return NextResponse.json({ success: true, exitPlan });
  } catch (error: unknown) {
    console.error("POST exit plan error:", error);
    return NextResponse.json({ error: "Failed to save exit strategy plan" }, { status: 500 });
  }
}
