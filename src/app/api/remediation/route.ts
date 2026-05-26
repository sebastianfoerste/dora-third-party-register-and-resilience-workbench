import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description, owner, dueDate, severity } = body;

    if (!title || !description || !owner || !severity) {
      return NextResponse.json({ error: "Title, description, owner, and severity are required." }, { status: 400 });
    }

    const task = await prisma.remediationTask.create({
      data: {
        title,
        description,
        owner,
        dueDate: dueDate ? new Date(dueDate) : null,
        severity,
        status: "OPEN",
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        actor: "Security Operations Analyst",
        action: "CREATE_REMEDIATION_TASK",
        object: `RemediationTask:${task.id}`,
        afterSnapshot: JSON.stringify(task),
      },
    });

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    console.error("POST create remediation task error:", error);
    return NextResponse.json({ error: "Failed to create remediation task: " + error.message }, { status: 500 });
  }
}
