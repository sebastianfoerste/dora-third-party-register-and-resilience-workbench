import { NextResponse } from "next/server";

import {
  buildExitPlanRehearsalCreateInput,
  summarizeLatestExitPlanRehearsal,
  type ExitPlanRehearsalStatus,
} from "@/lib/exit-plan-rehearsal";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

function isRehearsalStatus(value: unknown): value is ExitPlanRehearsalStatus {
  return value === "DRAFT" || value === "COMPLETED" || value === "FAILED" || value === "APPROVED";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get("serviceId");

    const rehearsals = await prisma.exitPlanRehearsal.findMany({
      where: serviceId ? { serviceId } : undefined,
      orderBy: { createdAt: "desc" },
      take: serviceId ? 25 : 100,
    });

    return NextResponse.json({
      success: true,
      rehearsals,
      latest: summarizeLatestExitPlanRehearsal(rehearsals),
    });
  } catch (error) {
    console.error("GET exit plan rehearsals error:", error);
    return NextResponse.json({ error: "Failed to load exit plan rehearsal ledger." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      serviceId,
      scenarioType,
      assumptions = {},
      outcome = {},
      survivabilityScore,
      status = "DRAFT",
      reviewer,
      approvedAt,
    } = body;

    if (!serviceId || !scenarioType) {
      return NextResponse.json({ error: "serviceId and scenarioType are required." }, { status: 400 });
    }
    if (!Number.isInteger(survivabilityScore) || survivabilityScore < 0 || survivabilityScore > 100) {
      return NextResponse.json({ error: "survivabilityScore must be an integer between 0 and 100." }, { status: 400 });
    }
    if (!isRehearsalStatus(status)) {
      return NextResponse.json({ error: "status must be DRAFT, COMPLETED, FAILED, or APPROVED." }, { status: 400 });
    }

    const service = await prisma.iCTService.findUnique({ where: { id: serviceId }, select: { id: true } });
    if (!service) {
      return NextResponse.json({ error: "Service not found." }, { status: 404 });
    }

    const rehearsal = await prisma.exitPlanRehearsal.create({
      data: buildExitPlanRehearsalCreateInput({
        serviceId,
        scenarioType,
        assumptions: assumptions && typeof assumptions === "object" ? assumptions : {},
        outcome: outcome && typeof outcome === "object" ? outcome : {},
        survivabilityScore,
        status,
        reviewer,
        approvedAt,
      }),
    });

    await prisma.auditLog.create({
      data: {
        actor: reviewer || "Exit Plan Reviewer",
        action: "CREATE_EXIT_PLAN_REHEARSAL",
        object: `ExitPlanRehearsal:${rehearsal.id}`,
        afterSnapshot: JSON.stringify({
          id: rehearsal.id,
          serviceId: rehearsal.serviceId,
          scenarioType: rehearsal.scenarioType,
          status: rehearsal.status,
          survivabilityScore: rehearsal.survivabilityScore,
          digest: rehearsal.digest,
        }),
      },
    });

    return NextResponse.json({ success: true, rehearsal });
  } catch (error) {
    console.error("POST exit plan rehearsal error:", error);
    return NextResponse.json({ error: "Failed to save exit plan rehearsal." }, { status: 500 });
  }
}
