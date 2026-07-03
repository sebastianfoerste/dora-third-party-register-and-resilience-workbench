import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalculateAllRegisters } from "@/lib/recalc";

export async function POST(req: Request) {
  try {
    // 1. Verify procurement integration is connected
    const procurementSetting = await prisma.integrationSetting.findFirst({
      where: { systemType: "PROCUREMENT" },
    });

    if (!procurementSetting || procurementSetting.status !== "CONNECTED") {
      return NextResponse.json({
        error: "Procurement integration is not connected. Please enable it in the Hub."
      }, { status: 400 });
    }

    // 2. Parse body payload
    const body = await req.json();
    const {
      vendorName,
      vendorCountry,
      lei,
      serviceDescription,
      supportedFunction,
      dataProcessed,
      location,
      subcontractingStatus,
      substitutability,
      governingLaw,
      sourceFile,
      effectiveDate,
      renewalDate,
      terminationDate,
      criticality,
      legalEntityId
    } = body;

    if (!vendorName || !serviceDescription || !supportedFunction) {
      return NextResponse.json({ error: "Missing required fields: vendorName, serviceDescription, supportedFunction" }, { status: 400 });
    }

    // 3. Resolve Legal Entity
    let targetLegalEntityId = legalEntityId;
    if (!targetLegalEntityId) {
      const le = await prisma.legalEntity.findFirst();
      if (!le) {
        return NextResponse.json({ error: "No regulated Legal Entities found in the database. Seed DB first." }, { status: 400 });
      }
      targetLegalEntityId = le.id;
    }

    // 4. Create/Get Vendor
    let vendor = await prisma.vendor.findFirst({
      where: { legalName: vendorName },
    });

    if (!vendor) {
      vendor = await prisma.vendor.create({
        data: {
          legalName: vendorName,
          country: vendorCountry || "DE",
          lei: lei || null,
          serviceCategories: "Imported via Procurement Sync",
          concentrationTags: "SaaS",
        },
      });
    }

    // 5. Create ICT Service
    const service = await prisma.iCTService.create({
      data: {
        vendorId: vendor.id,
        legalEntityId: targetLegalEntityId,
        serviceDescription,
        supportedFunction,
        dataProcessed: dataProcessed || "Customer PII, Operations logs",
        location: location || "EU-West (Ireland)",
        subcontractingStatus: subcontractingStatus || "NO",
        substitutability: substitutability || "MEDIUM",
        exitPlanStatus: "NONE",
      },
    });

    // 6. Create Contract
    const contract = await prisma.contract.create({
      data: {
        vendorId: vendor.id,
        legalEntityId: targetLegalEntityId,
        sourceFile: sourceFile || "Procurement_Imported_Contract.pdf",
        governingLaw: governingLaw || "Germany",
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        renewalDate: renewalDate ? new Date(renewalDate) : null,
        terminationDate: terminationDate ? new Date(terminationDate) : null,
        extractedText: `CONTRACT AGREEMENT: ${vendorName}\nThis document governs the provision of ${supportedFunction} services.\nGoverning law: ${governingLaw}.\n`
      },
    });

    // 7. Seed baseline clause findings as UNREVIEWED
    const requirements = await prisma.clauseRequirement.findMany();
    for (const req of requirements) {
      // Default to "UNREVIEWED" or "MISSING" for critical clauses to force manual audit verification
      const isCriticalNeeded = req.regulatoryBasis.includes("30(2)(h)") || req.regulatoryBasis.includes("30(2)(f)");
      await prisma.clauseFinding.create({
        data: {
          contractId: contract.id,
          requirementId: req.id,
          status: isCriticalNeeded ? "MISSING" : "UNREVIEWED",
          confidence: 0.50,
          extractedEvidence: null,
        },
      });
    }

    // 8. Create Register Entry (starts as INVALID with review date set to next week)
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 7);

    const registerEntry = await prisma.registerEntry.create({
      data: {
        legalEntityId: targetLegalEntityId,
        vendorId: vendor.id,
        serviceId: service.id,
        contractId: contract.id,
        criticality: criticality || "IMPORTANT",
        mandatoryFields: JSON.stringify(["legalEntityName", "vendorName", "serviceDescription", "criticality"]),
        validationStatus: "INVALID",
        validationErrors: JSON.stringify(["New contract review pending. Manual audit is required."]),
        nextReviewDue: nextReview,
      },
    });

    // 9. Run live recalculation to recalculate compliance metrics and logs
    await recalculateAllRegisters();

    // 10. Update last synced time on procurement connection
    await prisma.integrationSetting.update({
      where: { id: procurementSetting.id },
      data: { lastSyncedAt: new Date() },
    });

    // 11. Create sync log and audit log
    await prisma.integrationSyncLog.create({
      data: {
        systemType: "PROCUREMENT",
        action: "IMPORT",
        status: "SUCCESS",
        details: `Imported contract for vendor '${vendorName}' (${supportedFunction}) from Coupa/Ironclad. Set up register entry #${registerEntry.id}.`,
        recordsCount: 1,
      },
    });

    await prisma.auditLog.create({
      data: {
        actor: "Procurement Bot",
        action: "WEBHOOK_IMPORT_CONTRACT",
        object: `Contract:${contract.id}`,
        afterSnapshot: JSON.stringify({ vendor, service, contract, registerEntry }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Contract for vendor '${vendorName}' successfully imported via webhook.`,
      registerEntryId: registerEntry.id,
      contractId: contract.id,
    });
  } catch (error: unknown) {
    console.error("Procurement import error:", error);
    return NextResponse.json({ error: "Server error processing procurement webhook" }, { status: 500 });
  }
}
