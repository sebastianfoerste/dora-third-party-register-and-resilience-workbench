import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeRegisterCriticality, validateRegisterEntry } from "@/lib/validators";

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
      include: {
        finding: {
          include: {
            contract: {
              include: {
                vendor: true,
                legalEntity: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Remediation task not found" }, { status: 404 });
    }

    const beforeSnapshot = JSON.stringify(task);

    // Update the task itself
    const updatedTask = await prisma.remediationTask.update({
      where: { id },
      data: {
        status: status || task.status,
        resolutionEvidence: resolutionEvidence || task.resolutionEvidence,
        owner: owner || task.owner,
      },
    });

    // CLOSED COMPLIANCE LOOP: If task resolved, update associated clause finding & register entry
    if (status === "RESOLVED" && task.findingId) {
      // 1. Update finding in DB
      await prisma.clauseFinding.update({
        where: { id: task.findingId },
        data: {
          status: "PRESENT",
          reviewerDecision: "RESOLVED_BY_REMEDIATION",
          reviewerComments: resolutionEvidence || "Resolved through Remediation Tracker.",
        },
      });

      // 2. Fetch service & register entry to rerun validation
      const contract = task.finding?.contract;
      if (contract) {
        const service = await prisma.iCTService.findFirst({
          where: {
            vendorId: contract.vendorId,
            legalEntityId: contract.legalEntityId,
          },
        });

        if (service) {
          const regEntry = await prisma.registerEntry.findFirst({
            where: { serviceId: service.id },
          });

          if (regEntry) {
            // Fetch all findings for this contract to rerun complete validation
            const allFindings = await prisma.clauseFinding.findMany({
              where: { contractId: contract.id },
              include: { requirement: true },
            });

            const findingsMapped = allFindings.map((f) => ({
              requirementId: f.requirementId,
              requirementName: f.requirement.requirementName,
              status: f.id === task.findingId ? "PRESENT" : f.status,
              severity: f.requirement.severity,
            }));

            const valRes = validateRegisterEntry({
              legalEntity: contract.legalEntity,
              vendor: contract.vendor,
              service,
              contract,
              findings: findingsMapped,
              criticality: normalizeRegisterCriticality(regEntry.criticality),
            });

            await prisma.registerEntry.update({
              where: { id: regEntry.id },
              data: {
                validationStatus: valRes.status,
                validationErrors: JSON.stringify(valRes.errors.map((e) => e.message)),
              },
            });
          }
        }
      }
    }

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actor: owner || "Compliance Lead",
        action: "RESOLVE_REMEDIATION_TASK",
        object: `RemediationTask:${id}`,
        beforeSnapshot,
        afterSnapshot: JSON.stringify(updatedTask),
      },
    });

    return NextResponse.json({
      success: true,
      task: updatedTask,
    });
  } catch (error: unknown) {
    console.error("Task patch error:", error);
    return NextResponse.json({ error: "Server error updating remediation task" }, { status: 500 });
  }
}
