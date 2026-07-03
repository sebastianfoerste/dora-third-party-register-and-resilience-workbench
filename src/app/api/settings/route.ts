import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalculateAllRegisters } from "@/lib/recalc";

export const revalidate = 0;

export async function GET() {
  try {
    const settings = await prisma.policySetting.findMany();
    
    // Provide sensible fallbacks if empty
    const defaults = {
      enforce_eea_data_residency: "true",
      enforce_eu_governing_law: "true",
      enforce_exit_plan_for_critical_services: "true",
      sla_max_downtime_minutes: "120",
    };

    const responseMap: Record<string, string> = { ...defaults };
    settings.forEach((s) => {
      responseMap[s.key] = s.value;
    });

    return NextResponse.json({ success: true, settings: responseMap });
  } catch (error: unknown) {
    console.error("GET settings error:", error);
    return NextResponse.json({ error: "Failed to load policy settings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { settings } = body; // Map of key -> value

    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "Invalid settings format" }, { status: 400 });
    }

    const beforeSnap = await prisma.policySetting.findMany();

    // Upsert each setting
    for (const [key, value] of Object.entries(settings)) {
      await prisma.policySetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: {
          key,
          value: String(value),
          description: `Custom policy setting for ${key}`,
        },
      });
    }

    const afterSnap = await prisma.policySetting.findMany();

    // Recalculate register scores based on new settings
    await recalculateAllRegisters();

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        actor: "Compliance Officer",
        action: "UPDATE_POLICY_SETTINGS",
        object: "PolicySettings",
        beforeSnapshot: JSON.stringify(beforeSnap),
        afterSnapshot: JSON.stringify(afterSnap),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("POST settings error:", error);
    return NextResponse.json({ error: "Failed to update policy settings" }, { status: 500 });
  }
}
