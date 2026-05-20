import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export async function GET() {
  try {
    const incidents = await prisma.incidentLog.findMany({
      include: {
        service: {
          include: {
            vendor: true,
          },
        },
      },
      orderBy: {
        incidentDate: "desc",
      },
    });

    const services = await prisma.iCTService.findMany({
      include: {
        vendor: true,
      },
    });

    return NextResponse.json({ success: true, incidents, services });
  } catch (error: any) {
    console.error("GET incidents error:", error);
    return NextResponse.json({ error: "Failed to load incidents" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, serviceId, title, severity, description, incidentDate, downtimeMinutes, status, remediationAction } = body;

    if (!serviceId || !title || !severity || !status) {
      return NextResponse.json({ error: "Service, title, severity, and status are required." }, { status: 400 });
    }

    const parsedDate = incidentDate ? new Date(incidentDate) : new Date();
    const parsedDowntime = downtimeMinutes ? parseInt(String(downtimeMinutes), 10) : 0;

    let incident;
    if (id) {
      // Update
      incident = await prisma.incidentLog.update({
        where: { id },
        data: {
          serviceId,
          title,
          severity,
          description,
          incidentDate: parsedDate,
          downtimeMinutes: parsedDowntime,
          status,
          remediationAction,
        },
      });
    } else {
      // Create new
      incident = await prisma.incidentLog.create({
        data: {
          serviceId,
          title,
          severity,
          description,
          incidentDate: parsedDate,
          downtimeMinutes: parsedDowntime,
          status,
          remediationAction,
        },
      });
    }

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        actor: "Incident Responder",
        action: id ? "UPDATE_INCIDENT_REPORT" : "LOG_INCIDENT_REPORT",
        object: `IncidentLog:${incident.id}`,
        afterSnapshot: JSON.stringify(incident),
      },
    });

    return NextResponse.json({ success: true, incident });
  } catch (error: any) {
    console.error("POST incident error:", error);
    return NextResponse.json({ error: "Failed to save incident report" }, { status: 500 });
  }
}
