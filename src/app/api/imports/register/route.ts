import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeRegisterCriticality, validateRegisterEntry } from "@/lib/validators";
import { getErrorMessage } from "@/lib/error-message";

// Robust RFC 4180 CSV parser
function parseCSV(content: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = "";

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(currentVal.trim());
      currentVal = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      row.push(currentVal.trim());
      lines.push(row);
      row = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }
  if (currentVal || row.length > 0) {
    row.push(currentVal.trim());
    lines.push(row);
  }
  return lines.filter((r) => r.length > 0 && r.some((cell) => cell !== ""));
}

export async function POST(req: Request) {
  try {
    const { csvContent, mapping } = await req.json();

    if (!csvContent) {
      return NextResponse.json({ error: "Missing csvContent" }, { status: 400 });
    }

    if (!mapping) {
      return NextResponse.json({ error: "Missing mapping configuration" }, { status: 400 });
    }

    const rows = parseCSV(csvContent);
    if (rows.length < 2) {
      return NextResponse.json({ error: "CSV must contain at least a header and one data row" }, { status: 400 });
    }

    const header = rows[0];
    const dataRows = rows.slice(1);

    // Map column names to index numbers
    const getIndex = (field: string) => {
      const colName = mapping[field];
      if (!colName) return -1;
      return header.findIndex((h) => h.toLowerCase() === colName.toLowerCase());
    };

    const idxLE = getIndex("legalEntityName");
    const idxLE_LEI = getIndex("legalEntityLei");
    const idxVendor = getIndex("vendorName");
    const idxVendor_LEI = getIndex("vendorLei");
    const idxService = getIndex("serviceDescription");
    const idxFunction = getIndex("supportedFunction");
    const idxLocation = getIndex("location");
    const idxSubcontracting = getIndex("subcontractingStatus");
    const idxSubstitutability = getIndex("substitutability");
    const idxExitPlan = getIndex("exitPlanStatus");

    if (idxLE === -1 || idxVendor === -1 || idxService === -1) {
      return NextResponse.json(
        { error: "Mapping must at least include Legal Entity, Vendor Name, and Service Description." },
        { status: 400 }
      );
    }

    let importedCount = 0;
    const errors: string[] = [];

    // Run import transactions sequentially
    for (const row of dataRows) {
      try {
        const leName = row[idxLE] || "Unknown Entity";
        const leLei = idxLE_LEI !== -1 ? (row[idxLE_LEI] || null) : null;
        const vendorName = row[idxVendor] || "Unknown Vendor";
        const vendorLei = idxVendor_LEI !== -1 ? (row[idxVendor_LEI] || null) : null;
        const serviceDesc = row[idxService] || "No description provided.";
        const functionName = idxFunction !== -1 ? row[idxFunction] || "General Support" : "General Support";
        const location = idxLocation !== -1 ? row[idxLocation] || "EU" : "EU";
        const subcon = idxSubcontracting !== -1 ? row[idxSubcontracting] || "NO" : "NO";
        const subst = idxSubstitutability !== -1 ? row[idxSubstitutability] || "EASY" : "EASY";
        const exitPlan = idxExitPlan !== -1 ? row[idxExitPlan] || "NONE" : "NONE";

        // Find or create LegalEntity
        let legalEntity = await prisma.legalEntity.findFirst({
          where: { name: leName },
        });
        if (!legalEntity) {
          legalEntity = await prisma.legalEntity.create({
            data: {
              name: leName,
              lei: leLei,
              jurisdiction: "DE", // Default to Germany
              licenceType: "CASP",
              competentAuthority: "BaFin",
              regulatedStatus: true,
            },
          });
        } else if (leLei && !legalEntity.lei) {
          legalEntity = await prisma.legalEntity.update({
            where: { id: legalEntity.id },
            data: { lei: leLei },
          });
        }

        // Find or create Vendor
        let vendor = await prisma.vendor.findFirst({
          where: { legalName: vendorName },
        });
        if (!vendor) {
          vendor = await prisma.vendor.create({
            data: {
              legalName: vendorName,
              lei: vendorLei,
              country: "DE", // Default
              serviceCategories: "Imported Service Category",
              concentrationTags: "Imported",
            },
          });
        } else if (vendorLei && !vendor.lei) {
          vendor = await prisma.vendor.update({
            where: { id: vendor.id },
            data: { lei: vendorLei },
          });
        }

        // Create ICTService
        const service = await prisma.iCTService.create({
          data: {
            vendorId: vendor.id,
            legalEntityId: legalEntity.id,
            serviceDescription: serviceDesc,
            supportedFunction: functionName,
            dataProcessed: "Customer Data",
            location: location,
            subcontractingStatus: subcon.toUpperCase() === "YES" || subcon.toUpperCase() === "Y" ? "YES" : "NO",
            substitutability: subst.toUpperCase().startsWith("DIF") ? "DIFFICULT" : subst.toUpperCase().startsWith("MED") ? "MEDIUM" : "EASY",
            exitPlanStatus: exitPlan.toUpperCase().startsWith("APP") ? "APPROVED" : exitPlan.toUpperCase().startsWith("DRA") ? "DRAFT" : "NONE",
          },
        });

        // Determine default criticality (simple rule)
        const isCritical =
          functionName.toLowerCase().includes("core") ||
          functionName.toLowerCase().includes("ledger") ||
          functionName.toLowerCase().includes("custody") ||
          subst.toUpperCase().startsWith("DIF");
        const criticalityResult = isCritical ? "CRITICAL" : "NON_CRITICAL";

        // Create criticality assessment
        await prisma.criticalityAssessment.create({
          data: {
            serviceId: service.id,
            function: functionName,
            scoringInputs: JSON.stringify({ substitutability: service.substitutability }),
            result: criticalityResult,
            confidence: 0.85,
            reviewer: "System Importer",
            status: "APPROVED",
            evidence: "Created during system CSV import mapping.",
          },
        });

        // Run validation check
        const valRes = validateRegisterEntry({
          legalEntity,
          vendor,
          service,
          contract: null,
          findings: [],
          criticality: normalizeRegisterCriticality(criticalityResult),
        });

        // Create RegisterEntry
        await prisma.registerEntry.create({
          data: {
            legalEntityId: legalEntity.id,
            vendorId: vendor.id,
            serviceId: service.id,
            contractId: null,
            criticality: criticalityResult,
            mandatoryFields: JSON.stringify(["legalEntityName", "vendorName", "serviceDescription"]),
            validationStatus: valRes.status,
            validationErrors: JSON.stringify(valRes.errors.map((e) => e.message)),
          },
        });

        importedCount++;
      } catch (err: unknown) {
        errors.push(`Row ${dataRows.indexOf(row) + 2}: ${getErrorMessage(err)}`);
      }
    }

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actor: "Compliance Lead",
        action: "IMPORT_REGISTER",
        object: "RegisterEntry",
        afterSnapshot: JSON.stringify({
          importedCount,
          errorsCount: errors.length,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      importedCount,
      failedCount: errors.length,
      errors,
    });
  } catch (error: unknown) {
    console.error("CSV Import error:", error);
    return NextResponse.json({ error: "Server error during import processing" }, { status: 500 });
  }
}
