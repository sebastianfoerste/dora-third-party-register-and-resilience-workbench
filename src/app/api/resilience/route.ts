import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalculateAllRegisters } from "@/lib/recalc";

export const revalidate = 0;

export async function GET() {
  try {
    const tests = await prisma.resilienceTest.findMany({
      include: {
        service: {
          include: {
            vendor: true,
          },
        },
      },
      orderBy: {
        testDate: "desc",
      },
    });

    const services = await prisma.iCTService.findMany({
      include: {
        vendor: true,
      },
    });

    const threatIntel = await prisma.threatIntel.findMany({
      include: {
        vendor: true,
      },
      orderBy: {
        detectedAt: "desc",
      },
    });

    const simulations = await prisma.simulationRun.findMany({
      orderBy: {
        testedAt: "desc",
      },
      take: 10,
    });

    return NextResponse.json({ success: true, tests, services, threatIntel, simulations });
  } catch (error: unknown) {
    console.error("GET resilience tests error:", error);
    return NextResponse.json({ error: "Failed to load resilience tests" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { serviceId, testType, testDate, status, findingsCount, evidenceSummary } = body;

    if (!serviceId || !testType || !testDate || !status) {
      return NextResponse.json({ error: "Service, test type, date, and status are required." }, { status: 400 });
    }

    const test = await prisma.resilienceTest.create({
      data: {
        serviceId,
        testType,
        testDate: new Date(testDate),
        status,
        findingsCount: parseInt(String(findingsCount), 10) || 0,
        evidenceSummary: evidenceSummary || "",
        nextScheduledDate: new Date(new Date(testDate).getTime() + 365 * 24 * 60 * 60 * 1000), // Default next in 365 days
      },
    });

    // Recalculate all registers to update status scores based on the new resilience evidence
    await recalculateAllRegisters();

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        actor: "Resilience Engineer",
        action: "LOG_RESILIENCE_TEST",
        object: `ResilienceTest:${test.id}`,
        afterSnapshot: JSON.stringify(test),
      },
    });

    return NextResponse.json({ success: true, test });
  } catch (error: unknown) {
    console.error("POST resilience test error:", error);
    return NextResponse.json({ error: "Failed to log resilience test" }, { status: 500 });
  }
}
