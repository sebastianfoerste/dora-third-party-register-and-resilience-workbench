import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const actorFilter = searchParams.get("actor");
    const actionFilter = searchParams.get("action");
    const searchFilter = searchParams.get("search");
    const format = searchParams.get("format");

    // Construct Prisma where query
    const where: any = {};
    if (actorFilter && actorFilter !== "all") {
      where.actor = actorFilter;
    }
    if (actionFilter && actionFilter !== "all") {
      where.action = actionFilter;
    }
    if (searchFilter) {
      where.OR = [
        { actor: { contains: searchFilter } },
        { action: { contains: searchFilter } },
        { object: { contains: searchFilter } },
        { beforeSnapshot: { contains: searchFilter } },
        { afterSnapshot: { contains: searchFilter } }
      ];
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
    });

    if (format === "json") {
      return NextResponse.json({ success: true, logs });
    }

    const csvEscape = (val: string | null | undefined) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).trim();
      return `"${str.replace(/"/g, '""')}"`;
    };

    const csvRows = [];
    // CSV Header
    const headers = [
      "Event ID",
      "Timestamp (UTC)",
      "Actor",
      "Action Executed",
      "Target Object",
      "Before Event State",
      "After Event State"
    ];
    csvRows.push(headers.map(h => `"${h}"`).join(","));

    for (const log of logs) {
      const row = [
        log.id,
        new Date(log.timestamp).toISOString(),
        log.actor,
        log.action,
        log.object,
        log.beforeSnapshot || "N/A",
        log.afterSnapshot || "N/A"
      ];
      csvRows.push(row.map(csvEscape).join(","));
    }

    const csvContent = csvRows.join("\n");

    return new Response(csvContent, {
      headers: {
        "Content-Disposition": 'attachment; filename="supervisory_audit_trail.csv"',
        "Content-Type": "text/csv; charset=utf-8"
      }
    });
  } catch (error: any) {
    console.error("GET export audit logs error:", error);
    return NextResponse.json({ error: "Failed to generate CSV audit logs: " + error.message }, { status: 500 });
  }
}
