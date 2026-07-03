import { NextResponse } from "next/server";
import type { Contract } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractMetadataFromContract } from "@/lib/ai";
import { normalizeRegisterCriticality, validateRegisterEntry } from "@/lib/validators";
import { DORA_CLAUSE_REQUIREMENTS } from "@/lib/dora-rules";

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

    const textToExtract = contract.extractedText || `Contract for services between ${contract.legalEntity.name} and ${contract.vendor.legalName}. Mapped governing law is ${contract.governingLaw}.`;

    // Trigger AI extraction
    const extractedData = await extractMetadataFromContract(textToExtract);

    // Update contract metadata if changes found and not empty
    const updateData: Partial<Pick<Contract, "governingLaw" | "effectiveDate" | "terminationDate">> = {};
    if (extractedData.governingLaw && contract.governingLaw === "Unknown") {
      updateData.governingLaw = extractedData.governingLaw;
    }
    if (extractedData.effectiveDate && !contract.effectiveDate) {
      updateData.effectiveDate = new Date(extractedData.effectiveDate);
    }
    if (extractedData.terminationDate && !contract.terminationDate) {
      updateData.terminationDate = new Date(extractedData.terminationDate);
    }
    
    if (Object.keys(updateData).length > 0) {
      await prisma.contract.update({
        where: { id },
        data: updateData,
      });
    }

    // Upsert requirements in DB if missing (precautionary)
    const requirements = await prisma.clauseRequirement.findMany();
    if (requirements.length === 0) {
      for (const req of DORA_CLAUSE_REQUIREMENTS) {
        await prisma.clauseRequirement.create({ data: req });
      }
    }
    const dbRequirements = await prisma.clauseRequirement.findMany();

    // Clear old findings for this contract
    await prisma.clauseFinding.deleteMany({
      where: { contractId: id },
    });

    // Create new clause findings
    const findingsResult = [];
    for (const item of extractedData.clauses) {
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

      // Automatically create a Remediation Task if the clause is MISSING and severity is HIGH/MEDIUM
      if (item.status === "MISSING" && (dbReq.severity === "HIGH" || dbReq.severity === "MEDIUM")) {
        await prisma.remediationTask.create({
          data: {
            findingId: finding.id,
            title: `Add missing ${dbReq.requirementName} clause`,
            description: `DORA gap analysis flagged the ${dbReq.requirementName} clause (${dbReq.regulatoryBasis}) as MISSING for vendor ${contract.vendor.legalName}. Please negotiate remediation.`,
            owner: "legal-reviewer@casp-workbench.de",
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days out
            severity: dbReq.severity,
            status: "OPEN",
          },
        });
      }
    }

    // Refresh validation of associated register entries
    const service = await prisma.iCTService.findFirst({
      where: {
        vendorId: contract.vendorId,
        legalEntityId: contract.legalEntityId,
      },
    });

    if (service) {
      // Find register entry
      const regEntry = await prisma.registerEntry.findFirst({
        where: { serviceId: service.id },
      });

      if (regEntry) {
        // Run validation
        const valRes = validateRegisterEntry({
          legalEntity: contract.legalEntity,
          vendor: contract.vendor,
          service,
          contract: {
            ...contract,
            ...updateData,
          },
          findings: findingsResult,
          criticality: normalizeRegisterCriticality(regEntry.criticality),
        });

        // Update register entry status
        await prisma.registerEntry.update({
          where: { id: regEntry.id },
          data: {
            contractId: contract.id,
            validationStatus: valRes.status,
            validationErrors: JSON.stringify(valRes.errors.map((e) => e.message)),
          },
        });
      }
    }

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actor: "AI Analyst",
        action: "EXTRACT_CONTRACT_CLAUSES",
        object: `Contract:${id}`,
        afterSnapshot: JSON.stringify({
          findingsCount: findingsResult.length,
          missingClauses: findingsResult.filter((f) => f.status === "MISSING").length,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      extractedData,
      findings: findingsResult,
    });
  } catch (error: unknown) {
    console.error("Contract extraction error:", error);
    return NextResponse.json({ error: "Server error during contract extraction" }, { status: 500 });
  }
}
