import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateRegisterEntry } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { assessmentId, status, reviewer, result } = body;

    if (!assessmentId || !status || !reviewer || !result) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const assessment = await prisma.criticalityAssessment.findUnique({
      where: { id: assessmentId },
      include: {
        service: {
          include: {
            vendor: true,
            legalEntity: true,
          },
        },
      },
    });

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    const beforeSnapshot = JSON.stringify(assessment);

    // Update assessment
    const updatedAssessment = await prisma.criticalityAssessment.update({
      where: { id: assessmentId },
      data: {
        status,
        reviewer,
        result,
      },
    });

    // Refresh register entry criticality and validation
    const service = assessment.service;
    const regEntry = await prisma.registerEntry.findFirst({
      where: { serviceId: service.id },
    });

    if (regEntry) {
      const contract = await prisma.contract.findFirst({
        where: {
          vendorId: service.vendorId,
          legalEntityId: service.legalEntityId,
        },
        include: {
          clauseFindings: {
            include: { requirement: true },
          },
        },
      });

      const findings = contract
        ? contract.clauseFindings.map((f) => ({
            requirementId: f.requirementId,
            requirementName: f.requirement.requirementName,
            status: f.status,
            severity: f.requirement.severity,
          }))
        : [];

      const valRes = validateRegisterEntry({
        legalEntity: service.legalEntity,
        vendor: service.vendor,
        service,
        contract,
        findings,
        criticality: result,
      });

      await prisma.registerEntry.update({
        where: { id: regEntry.id },
        data: {
          criticality: result,
          validationStatus: valRes.status,
          validationErrors: JSON.stringify(valRes.errors.map((e) => e.message)),
        },
      });
    }

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actor: reviewer,
        action: "APPROVE_CRITICALITY_ASSESSMENT",
        object: `CriticalityAssessment:${assessmentId}`,
        beforeSnapshot,
        afterSnapshot: JSON.stringify(updatedAssessment),
      },
    });

    return NextResponse.json({
      success: true,
      assessment: updatedAssessment,
    });
  } catch (error: unknown) {
    console.error("Criticality review error:", error);
    return NextResponse.json({ error: "Server error during criticality review" }, { status: 500 });
  }
}
