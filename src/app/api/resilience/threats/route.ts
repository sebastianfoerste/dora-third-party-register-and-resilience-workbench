import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalculateAllRegisters } from "@/lib/recalc";
import { getErrorMessage } from "@/lib/error-message";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { vendorId, cveId, description, severity, status } = body;

    if (!vendorId || !cveId || !description || !severity || !status) {
      return NextResponse.json({ error: "Vendor, CVE ID, description, severity, and status are required." }, { status: 400 });
    }

    const threat = await prisma.threatIntel.create({
      data: {
        vendorId,
        cveId,
        description,
        severity,
        status,
      },
    });

    // Recalculate register items
    await recalculateAllRegisters();

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        actor: "Security Operations Analyst",
        action: "INGEST_THREAT_CVE",
        object: `ThreatIntel:${threat.id}`,
        afterSnapshot: JSON.stringify(threat),
      },
    });

    return NextResponse.json({ success: true, threat });
  } catch (error: unknown) {
    console.error("POST ingest threat CVE error:", error);
    return NextResponse.json({ error: "Failed to ingest threat CVE: " + getErrorMessage(error) }, { status: 500 });
  }
}
