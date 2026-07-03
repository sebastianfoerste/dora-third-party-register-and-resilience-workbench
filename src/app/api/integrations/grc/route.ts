import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalculateAllRegisters } from "@/lib/recalc";

export async function POST() {
  try {
    // Perform a live recalculation to ensure stats are absolutely fresh
    await recalculateAllRegisters();

    // Fetch register entries
    const entries = await prisma.registerEntry.findMany({
      include: {
        legalEntity: true,
        vendor: true,
        service: true,
      },
    });

    const findings = await prisma.clauseFinding.findMany();
    const activeTasks = await prisma.remediationTask.findMany({
      where: { status: "OPEN" },
    });

    // Calculate metrics
    const totalControls = findings.length;
    const passedControls = findings.filter((f) => f.status === "PRESENT").length;
    const missingControls = findings.filter((f) => f.status === "MISSING").length;
    const partialControls = findings.filter((f) => f.status === "PARTIAL").length;

    const complianceRatio = totalControls > 0 ? (passedControls / totalControls) * 100 : 100;
    const criticalCount = entries.filter((e) => e.criticality === "CRITICAL").length;
    
    // Simulate GRC Control Payload
    const grcPayload = {
      complianceEngine: "DORA Register and Resilience Workbench v1.2",
      syncTimestamp: new Date().toISOString(),
      governedEntities: Array.from(new Set(entries.map((e) => e.legalEntity.name))),
      summaryMetrics: {
        totalGovernanceScope: entries.length,
        registerHealthScore: Math.round(complianceRatio),
        criticalVendorServicesCount: criticalCount,
        openRiskRemediationTasks: activeTasks.length,
      },
      doraArticle30ControlMatrix: {
        totalEvaluatedClauses: totalControls,
        compliantClauses: passedControls,
        partialGaps: partialControls,
        criticalMissingClauses: missingControls,
      },
      remediationSummary: activeTasks.map((t) => ({
        id: t.id,
        title: t.title,
        severity: t.severity,
        dueDate: t.dueDate,
      })),
    };

    // Find the GRC configuration in database to verify it's active
    const grcSetting = await prisma.integrationSetting.findFirst({
      where: { systemType: "GRC" },
    });

    if (!grcSetting || grcSetting.status !== "CONNECTED") {
      return NextResponse.json({ 
        error: "GRC Connector is not currently connected. Please configure and test it in the Integrations Hub first." 
      }, { status: 400 });
    }

    // Simulate sending data (delay)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Update last synced time
    await prisma.integrationSetting.update({
      where: { id: grcSetting.id },
      data: { lastSyncedAt: new Date() },
    });

    // Log the sync event
    await prisma.integrationSyncLog.create({
      data: {
        systemType: "GRC",
        action: "EXPORT",
        status: "SUCCESS",
        details: `Successfully exported DORA metrics (${entries.length} register entries, ${totalControls} controls) to ${grcSetting.name} at ${grcSetting.endpointUrl}.`,
        recordsCount: entries.length,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actor: "Compliance Lead",
        action: "SYNC_GRC",
        object: `Integration:${grcSetting.name}`,
        afterSnapshot: JSON.stringify({ payloadSent: grcPayload }),
      },
    });

    return NextResponse.json({
      success: true,
      recordsSyncedCount: entries.length,
      payload: grcPayload,
    });
  } catch (error: unknown) {
    console.error("GRC sync error:", error);
    return NextResponse.json({ error: "Server error during GRC synchronization" }, { status: 500 });
  }
}
