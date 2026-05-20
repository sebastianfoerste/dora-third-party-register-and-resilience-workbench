import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
