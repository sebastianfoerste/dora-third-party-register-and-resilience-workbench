import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalculateAllRegisters } from "@/lib/recalc";

export const revalidate = 0;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const subcontractors = await prisma.subcontractor.findMany({
      where: { serviceId: id },
    });
    return NextResponse.json({ success: true, subcontractors });
  } catch (error: any) {
    console.error("GET subcontractors error:", error);
    return NextResponse.json({ error: "Failed to load subcontractors" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, lei, country, serviceDescription, criticality, location } = body;

    if (!name || !country || !location) {
      return NextResponse.json({ error: "Name, country, and location are required." }, { status: 400 });
    }

    const sub = await prisma.subcontractor.create({
      data: {
        serviceId: id,
        name,
        lei,
        country,
        serviceDescription,
        criticality: criticality || "NON_CRITICAL",
        location,
      },
    });

    // Update parent service subcontractingStatus to YES
    const service = await prisma.iCTService.findUnique({
      where: { id },
      include: { subcontractors: true },
    });

    if (service) {
      const allNames = service.subcontractors.map((s) => s.name).join(", ");
      await prisma.iCTService.update({
        where: { id },
        data: {
          subcontractingStatus: "YES",
          subcontractorDetails: allNames,
        },
      });
    }

    // Trigger compliance recalculations
    await recalculateAllRegisters();

    // Audit Log
    await prisma.auditLog.create({
      data: {
        actor: "Vendor Analyst",
        action: "ADD_SUBCONTRACTOR",
        object: `Subcontractor:${sub.id}`,
        afterSnapshot: JSON.stringify(sub),
      },
    });

    return NextResponse.json({ success: true, subcontractor: sub });
  } catch (error: any) {
    console.error("POST subcontractor error:", error);
    return NextResponse.json({ error: "Failed to add subcontractor" }, { status: 500 });
  }
}
