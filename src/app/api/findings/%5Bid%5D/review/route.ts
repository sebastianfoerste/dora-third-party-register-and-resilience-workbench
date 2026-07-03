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
      return NextResponse.json({ error: "Missing finding ID" }, { status: 400 });
    }
    const body = await req.json();
    const { status, reviewerDecision, reviewerComments } = body;

    const finding = await prisma.clauseFinding.findUnique({
      where: { id },
      include: {
        contract: {
          include: {
            vendor: true,
            legalEntity: true,
          },
        },
        requirement: true,
      },
    });

    if (!finding) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 });
    }

    const beforeSnapshot = JSON.stringify(finding);

    // Update the finding
    const updatedFinding = await prisma.clauseFinding.update({
      where: { id },
      data: {
        status: status || finding.status,
        reviewerDecision: reviewerDecision || "APPROVED",
        reviewerComments: reviewerComments || finding.reviewerComments,
      },
    });

    // If overridden as PRESENT or NOT_APPLICABLE, update associated remediation tasks to RESOLVED
    if (
      (status === "PRESENT" || status === "NOT_APPLICABLE") &&
      reviewerDecision === "OVERRIDDEN"
    ) {
      await prisma.remediationTask.updateMany({
        where: { findingId: id, status: "OPEN" },
        data: {
          status: "RESOLVED",
          resolutionEvidence: `Overridden by reviewer: ${reviewerComments || "No comment."}`,
        },
      });
    }

    // Refresh register entry validation
    const contract = finding.contract;
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
        // Fetch all findings for this contract to run validation
        const allFindings = await prisma.clauseFinding.findMany({
          where: { contractId: contract.id },
          include: { requirement: true },
        });

        const findingsMapped = allFindings.map((f) => ({
          requirementId: f.requirementId,
          requirementName: f.requirement.requirementName,
          status: f.id === id ? (status || f.status) : f.status,
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

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actor: "Legal Reviewer",
        action: "REVIEW_CLAUSE_FINDING",
        object: `ClauseFinding:${id}`,
        beforeSnapshot,
        afterSnapshot: JSON.stringify(updatedFinding),
      },
    });

    return NextResponse.json({
      success: true,
      finding: updatedFinding,
    });
  } catch (error: unknown) {
    console.error("Finding review error:", error);
    return NextResponse.json({ error: "Server error during finding review" }, { status: 500 });
  }
}
