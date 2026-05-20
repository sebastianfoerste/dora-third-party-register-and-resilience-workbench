import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { entityScope, exportFormat } = body; // entityScope can be "CONSOLIDATED" or a specific legalEntityId

    if (!entityScope || !exportFormat) {
      return NextResponse.json({ error: "entityScope and exportFormat are required." }, { status: 400 });
    }

    // Determine query filter
    const filter: any = {};
    let scopeName = "Consolidated Register";
    if (entityScope !== "CONSOLIDATED") {
      filter.legalEntityId = entityScope;
      const le = await prisma.legalEntity.findUnique({ where: { id: entityScope } });
      if (le) scopeName = `${le.name} Register`;
    }

    // Fetch entries
    const entries = await prisma.registerEntry.findMany({
      where: filter,
      include: {
        legalEntity: true,
        vendor: true,
        service: true,
        contract: true,
      },
    });

    // Compile warnings
    const warnings: string[] = [];
    const csvRows: string[][] = [
      [
        "Entity Name",
        "Entity LEI",
        "Jurisdiction",
        "Licence Type",
        "Competent Authority",
        "Vendor Name",
        "Vendor LEI",
        "Vendor Country",
        "ICT Service Description",
        "Supported Function",
        "Data Location",
        "Subcontracting Status",
        "Substitutability",
        "Exit Plan Status",
        "Criticality",
        "Validation Status",
      ],
    ];

    for (const entry of entries) {
      // Collect warnings
      if (entry.validationErrors) {
        try {
          const errors = JSON.parse(entry.validationErrors);
          errors.forEach((err: string) => {
            warnings.push(`[${entry.vendor.legalName} - ${entry.service.supportedFunction}]: ${err}`);
          });
        } catch (_) {}
      }

      // Add to CSV
      csvRows.push([
        entry.legalEntity.name,
        entry.legalEntity.lei || "N/A",
        entry.legalEntity.jurisdiction,
        entry.legalEntity.licenceType,
        entry.legalEntity.competentAuthority,
        entry.vendor.legalName,
        entry.vendor.lei || "N/A",
        entry.vendor.country,
        entry.service.serviceDescription.replace(/"/g, '""'),
        entry.service.supportedFunction,
        entry.service.location,
        entry.service.subcontractingStatus,
        entry.service.substitutability,
        entry.service.exitPlanStatus,
        entry.criticality,
        entry.validationStatus,
      ]);
    }

    // Convert to CSV String
    const csvContent = csvRows
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    // Ensure exports directory exists in public
    const publicExportsDir = path.join(process.cwd(), "public", "exports");
    if (!fs.existsSync(publicExportsDir)) {
      fs.mkdirSync(publicExportsDir, { recursive: true });
    }

    const filename = `dora_register_${entityScope}_${Date.now()}.csv`;
    const filepath = path.join(publicExportsDir, filename);
    fs.writeFileSync(filepath, csvContent);

    // Save Export Record in DB
    const roiExport = await prisma.roIExport.create({
      data: {
        entityScope: scopeName,
        exportFormat: exportFormat.toUpperCase(),
        generatedFiles: JSON.stringify([`/exports/${filename}`]),
        validationWarnings: JSON.stringify(warnings),
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actor: "Compliance Lead",
        action: "GENERATE_EXPORT",
        object: `RoIExport:${roiExport.id}`,
        afterSnapshot: JSON.stringify({ entriesCount: entries.length, warningsCount: warnings.length }),
      },
    });

    return NextResponse.json({
      success: true,
      export: {
        id: roiExport.id,
        entityScope: roiExport.entityScope,
        exportFormat: roiExport.exportFormat,
        generatedFiles: [`/exports/${filename}`],
        warningsCount: warnings.length,
        warnings,
        createdAt: roiExport.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Export creation error:", error);
    return NextResponse.json({ error: "Server error during export compilation" }, { status: 500 });
  }
}
