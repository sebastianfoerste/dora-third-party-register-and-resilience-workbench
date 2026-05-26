import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateRegisterEntry } from "@/lib/validators";
import { writeFile } from "fs/promises";
import path from "path";

export const revalidate = 0;

export async function GET() {
  try {
    const contractsCount = await prisma.contract.count();
    const vendorsCount = await prisma.vendor.count();

    // Calculate open vs resolved findings
    const findings = await prisma.clauseFinding.findMany();
    const openGapsCount = findings.filter(f => f.status === "MISSING" || f.status === "PARTIAL").length;
    const resolvedGapsCount = findings.filter(f => f.status === "PRESENT" && f.reviewerDecision === "RESOLVED_BY_REMEDIATION").length;
    const compliantCount = findings.filter(f => f.status === "PRESENT" && f.reviewerDecision !== "RESOLVED_BY_REMEDIATION").length;

    // Financial ROI assumptions
    const auditHoursPerContractManual = 40;
    const auditHoursPerContractPlatform = 2;
    const hourlyRateEur = 150; // Average CCO/Legal Counsel internal rate

    const hoursSaved = contractsCount * (auditHoursPerContractManual - auditHoursPerContractPlatform);
    const costSavedEur = hoursSaved * hourlyRateEur;

    // DORA Non-compliance fine exposure risk
    // 1% of daily global turnover. We assume group annual turnover of €365,000,000 (€1,000,000 daily turnover)
    const dailyGlobalTurnoverEur = 1000000;
    const maxDailyFinePenaltyEur = dailyGlobalTurnoverEur * 0.01; // €10,000 per day

    // Total daily fine exposure based on open compliance gaps
    const activeDailyExposureEur = openGapsCount * maxDailyFinePenaltyEur;

    // Risk reduction percentage
    const totalGaps = openGapsCount + resolvedGapsCount;
    const riskReductionRate = totalGaps > 0 ? Math.round((resolvedGapsCount / totalGaps) * 100) : 100;

    return NextResponse.json({
      success: true,
      metrics: {
        vendorsCount,
        contractsCount,
        openGapsCount,
        resolvedGapsCount,
        compliantCount,
        hoursSaved,
        costSavedEur,
        activeDailyExposureEur,
        maxDailyFinePenaltyEur,
        riskReductionRate,
        assumptions: {
          hourlyRateEur,
          dailyGlobalTurnoverEur,
        }
      }
    });
  } catch (error) {
    console.error("GET ROI metrics error:", error);
    return NextResponse.json({ error: "Failed to calculate compliance ROI metrics" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { entityScope, exportFormat } = body;

    if (!entityScope || !exportFormat) {
      return NextResponse.json({ error: "Compilation scope and export format are required." }, { status: 400 });
    }

    // Load active policy settings
    const dbSettings = await prisma.policySetting.findMany();
    const settingsMap: Record<string, string> = {};
    dbSettings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    const options = {
      enforceEEADataResidency: settingsMap["enforce_eea_data_residency"] === "true",
      enforceEUGoverningLaw: settingsMap["enforce_eu_governing_law"] === "true",
      enforceExitPlan: settingsMap["enforce_exit_plan_for_critical_services"] === "true",
    };

    // Load entries matching scope
    const entries = await prisma.registerEntry.findMany({
      where: entityScope !== "CONSOLIDATED" ? { legalEntityId: entityScope } : {},
      include: {
        legalEntity: true,
        vendor: true,
        service: {
          include: {
            resilienceTests: true,
          },
        },
        contract: {
          include: {
            clauseFindings: {
              include: { requirement: true },
            },
          },
        },
      },
    });

    const warnings: string[] = [];
    const csvRows: string[] = [];

    // CSV Headers matching standard ESMA columns
    const headers = [
      "Register Entry ID",
      "Legal Entity Name",
      "Legal Entity LEI",
      "Vendor Legal Name",
      "Vendor LEI",
      "Supported Function",
      "Service Description",
      "Data Location",
      "Criticality",
      "Exit Plan Status",
      "Governing Law",
      "Compliance Score (%)",
      "Validation Status",
      "Audit Gaps / Warnings"
    ];
    csvRows.push(headers.map(h => `"${h}"`).join(","));

    const csvEscape = (val: string | number | null | undefined) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).trim();
      return `"${str.replace(/"/g, '""')}"`;
    };

    for (const entry of entries) {
      const findingsMapped = entry.contract
        ? entry.contract.clauseFindings.map((f) => ({
            requirementId: f.requirementId,
            requirementName: f.requirement.requirementName,
            status: f.status,
            severity: f.requirement.severity,
          }))
        : [];

      const valResult = validateRegisterEntry({
        legalEntity: entry.legalEntity,
        vendor: entry.vendor,
        service: entry.service,
        contract: entry.contract,
        findings: findingsMapped,
        criticality: entry.criticality as any,
        nextReviewDue: entry.nextReviewDue,
        resilienceTests: (entry.service as any).resilienceTests,
      }, options);

      // Collect warnings
      valResult.errors.forEach((err) => {
        warnings.push(`${entry.vendor.legalName} (${entry.service.supportedFunction}): ${err.message}`);
      });

      const errorSummary = valResult.errors.map(e => e.message).join(" | ");

      const row = [
        entry.id,
        entry.legalEntity.name,
        entry.legalEntity.lei || "N/A",
        entry.vendor.legalName,
        entry.vendor.lei || "N/A",
        entry.service.supportedFunction,
        entry.service.serviceDescription,
        entry.service.location,
        entry.criticality,
        entry.service.exitPlanStatus,
        entry.contract?.governingLaw || "N/A",
        valResult.score,
        valResult.status,
        errorSummary || "Fully Compliant"
      ];

      csvRows.push(row.map(csvEscape).join(","));
    }

    const csvContent = csvRows.join("\n");
    const timestamp = Date.now();
    const scopeLabel = entityScope === "CONSOLIDATED" ? "consolidated" : "entity_" + entityScope.slice(0, 8);
    const filename = `dora_register_${scopeLabel}_${timestamp}.csv`;
    const relativePath = `/exports/${filename}`;
    const absolutePath = path.join(process.cwd(), "public", "exports", filename);

    // Write file to public/exports/
    await writeFile(absolutePath, csvContent, "utf-8");

    // Save export item to database
    const roiExport = await prisma.roIExport.create({
      data: {
        entityScope: entityScope === "CONSOLIDATED" ? "Consolidated Group Register" : `Entity Scope (${entityScope.slice(0, 8)})`,
        exportFormat,
        generatedFiles: JSON.stringify([relativePath]),
        validationWarnings: JSON.stringify(warnings),
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        actor: "Compliance Officer",
        action: "COMPILE_REGISTER_EXPORT",
        object: `RoIExport:${roiExport.id}`,
        afterSnapshot: JSON.stringify({
          id: roiExport.id,
          entityScope,
          exportFormat,
          files: [relativePath],
          warningsCount: warnings.length,
        }),
      },
    });

    return NextResponse.json({ success: true, export: roiExport });
  } catch (error: any) {
    console.error("POST compile register export error:", error);
    return NextResponse.json({ error: "Failed to compile register package: " + error.message }, { status: 500 });
  }
}
