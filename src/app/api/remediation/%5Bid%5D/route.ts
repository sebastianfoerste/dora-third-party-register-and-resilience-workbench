import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id?: string }>;
};

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    if (!id) {
      return NextResponse.json({ error: "Missing task ID" }, { status: 400 });
    }
    const body = await req.json();
    const { status, resolutionEvidence, owner } = body;

    const task = await prisma.remediationTask.findUnique({
      where: { id },
    });

    if (!task) {
      return NextResponse.json({ error: "Remediation task not found" }, { status: 404 });
    }

    const updatedTask = await prisma.remediationTask.update({
      where: { id },
      data: {
        status: status || task.status,
        resolutionEvidence: resolutionEvidence || task.resolutionEvidence,
        owner: owner || task.owner,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actor: owner || "Compliance Lead",
        action: "RESOLVE_REMEDIATION_TASK",
        object: `RemediationTask:${id}`,
        afterSnapshot: JSON.stringify(updatedTask),
      },
    });

    return NextResponse.json({
      success: true,
      task: updatedTask,
    });
  } catch (error: any) {
    console.error("Task patch error:", error);
    return NextResponse.json({ error: "Server error updating remediation task" }, { status: 500 });
  }
}
