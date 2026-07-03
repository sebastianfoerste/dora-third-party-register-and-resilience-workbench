import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractMetadataFromContract } from "@/lib/ai";
import { normalizeRegisterCriticality, validateRegisterEntry } from "@/lib/validators";

type RouteParams = {
  params: Promise<{ id?: string }>;
};

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    if (!id) {
      return NextResponse.json({ error: "Missing contract ID" }, { status: 400 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        vendor: true,
        legalEntity: true,
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (!contract.extractedText) {
      return NextResponse.json({ error: "Contract has no extracted text. Run extract job first." }, { status: 400 });
    }

    // Run AI/local clause analysis
    const result = await extractMetadataFromContract(contract.extractedText);

    // Get requirements
    const dbRequirements = await prisma.clauseRequirement.findMany();

    // Clear old findings
    await prisma.clauseFinding.deleteMany({
      where: { contractId: id },
    });

    // Create findings
    const findingsResult = [];
    for (const item of result.clauses) {
      const dbReq = dbRequirements.find((r) => r.id === item.requirementId);
      if (!dbReq) continue;

      const finding = await prisma.clauseFinding.create({
        data: {
          contractId: id,
          requirementId: dbReq.id,
          status: item.status,
          extractedEvidence: item.evidence,
          confidence: item.confidence,
        },
      });

      findingsResult.push({
        ...finding,
        requirementName: dbReq.requirementName,
        severity: dbReq.severity,
      });
    }

    // Refresh register entries
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
        const valRes = validateRegisterEntry({
          legalEntity: contract.legalEntity,
          vendor: contract.vendor,
          service,
          contract,
          findings: findingsResult,
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
        actor: "Legal Lead",
        action: "RUN_CLAUSE_REVIEW",
        object: `Contract:${id}`,
        afterSnapshot: JSON.stringify({ findingsCount: findingsResult.length }),
      },
    });

    return NextResponse.json({
      success: true,
      findings: findingsResult,
    });
  } catch (error: unknown) {
    console.error("Clause review error:", error);
    return NextResponse.json({ error: "Server error during clause review" }, { status: 500 });
  }
}
