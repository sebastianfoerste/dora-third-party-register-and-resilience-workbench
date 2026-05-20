import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalculateAllRegisters } from "@/lib/recalc";

export const revalidate = 0;

export async function GET() {
  try {
    const entries = await prisma.registerEntry.findMany({
      include: {
        legalEntity: true,
        vendor: true,
        service: true,
        reviewHistory: {
          orderBy: {
            reviewedAt: "desc",
          },
        },
      },
      orderBy: {
        nextReviewDue: "asc",
      },
    });

    return NextResponse.json({ success: true, entries });
  } catch (error: any) {
    console.error("GET annual reviews error:", error);
    return NextResponse.json({ error: "Failed to load annual review entries" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { registerEntryId, reviewer, notes } = body;

    if (!registerEntryId || !reviewer) {
      return NextResponse.json({ error: "Register entry ID and reviewer name are required." }, { status: 400 });
    }

    const today = new Date();
    const nextDue = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000); // 365 days out

    // 1. Update the register entry review dates
    const entry = await prisma.registerEntry.update({
      where: { id: registerEntryId },
      data: {
        lastReviewedAt: today,
        nextReviewDue: nextDue,
        reviewerNotes: notes || "",
      },
    });

    // 2. Add a ReviewCycle historical record
    const cycle = await prisma.reviewCycle.create({
      data: {
        registerEntryId,
        reviewedAt: today,
        reviewer,
        notes: notes || "",
        status: "COMPLETED",
      },
    });

    // 3. Recalculate compliance status for all registers (clearing overdue status)
    await recalculateAllRegisters();

    // 4. Audit Log
    await prisma.auditLog.create({
      data: {
        actor: reviewer,
        action: "SIGN_OFF_ANNUAL_REVIEW",
        object: `RegisterEntry:${registerEntryId}`,
        afterSnapshot: JSON.stringify({ entry, cycle }),
      },
    });

    return NextResponse.json({ success: true, entry, cycle });
  } catch (error: any) {
    console.error("POST annual review error:", error);
    return NextResponse.json({ error: "Failed to submit review sign-off" }, { status: 500 });
  }
}
