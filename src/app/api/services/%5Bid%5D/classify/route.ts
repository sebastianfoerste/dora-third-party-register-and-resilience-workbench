import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assessCriticality } from "@/lib/ai";
import { validateRegisterEntry } from "@/lib/validators";

type RouteParams = {
  params: Promise<{ id?: string }>;
};

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    if (!id) {
      return NextResponse.json({ error: "Missing service ID" }, { status: 400 });
    }
    const body = await req.json();
    const {
      supportedFunction,
      substitutability,
      exitPlanStatus,
      dataSensitivity,
      dependencySubcontractors,
    } = body;

    const service = await prisma.iCTService.findUnique({
      where: { id },
      include: {
        vendor: true,
        legalEntity: true,
      },
    });

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Call criticality engine
    const assessment = await assessCriticality({
      supportedFunction: supportedFunction || service.supportedFunction,
      substitutability: substitutability || service.substitutability,
      exitPlanStatus: exitPlanStatus || service.exitPlanStatus,
      dataSensitivity: dataSensitivity || "Customer PII",
      dependencySubcontractors: dependencySubcontractors || (service.subcontractingStatus === "YES" ? "YES" : "NO"),
    });

    // Update service fields if modified
    await prisma.iCTService.update({
      where: { id },
      data: {
        supportedFunction: supportedFunction || service.supportedFunction,
        substitutability: substitutability || service.substitutability,
        exitPlanStatus: exitPlanStatus || service.exitPlanStatus,
      },
    });

    // Create or update CriticalityAssessment in DB
    const dbAssessment = await prisma.criticalityAssessment.create({
      data: {
        serviceId: id,
        function: supportedFunction || service.supportedFunction,
        scoringInputs: JSON.stringify({
          substitutability: substitutability || service.substitutability,
          dataSensitivity: dataSensitivity || "Customer PII",
          dependencySubcontractors: dependencySubcontractors || "NO",
        }),
        result: assessment.result,
        confidence: assessment.confidence,
        status: "PENDING", // Human review gate
        evidence: assessment.evidence,
      },
    });

    // Refresh register entry
    const regEntry = await prisma.registerEntry.findFirst({
      where: { serviceId: id },
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
        service: {
          ...service,
          supportedFunction: supportedFunction || service.supportedFunction,
          substitutability: substitutability || service.substitutability,
          exitPlanStatus: exitPlanStatus || service.exitPlanStatus,
        },
        contract,
        findings,
        criticality: assessment.result,
      });

      await prisma.registerEntry.update({
        where: { id: regEntry.id },
        data: {
          criticality: assessment.result,
          validationStatus: valRes.status,
          validationErrors: JSON.stringify(valRes.errors.map((e) => e.message)),
        },
      });
    }

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actor: "ICT Risk Reviewer",
        action: "RUN_CRITICALITY_ASSESSMENT",
        object: `ICTService:${id}`,
        afterSnapshot: JSON.stringify({ result: assessment.result, confidence: assessment.confidence }),
      },
    });

    return NextResponse.json({
      success: true,
      assessment: dbAssessment,
    });
  } catch (error: unknown) {
    console.error("Criticality run error:", error);
    return NextResponse.json({ error: "Server error during criticality assessment" }, { status: 500 });
  }
}
