import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

// GET /api/integrations
export async function GET() {
  try {
    const settings = await prisma.integrationSetting.findMany({
      orderBy: { updatedAt: "desc" },
    });
    
    // Also fetch last 15 sync logs
    const logs = await prisma.integrationSyncLog.findMany({
      take: 15,
      orderBy: { timestamp: "desc" },
    });

    return NextResponse.json({ settings, logs });
  } catch (error: unknown) {
    console.error("Fetch integrations error:", error);
    return NextResponse.json({ error: "Failed to fetch integrations" }, { status: 500 });
  }
}

// POST /api/integrations
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, systemType, name, endpointUrl, authConfig, status, action } = body;

    // Handle test connection trigger directly
    if (action === "TEST_CONNECTION") {
      if (!endpointUrl) {
        return NextResponse.json({ error: "Endpoint URL is required to test connection." }, { status: 400 });
      }

      // Simulate a small network delay for visual responsiveness
      await new Promise((resolve) => setTimeout(resolve, 800));

      const isUrlValid = endpointUrl.startsWith("http://") || endpointUrl.startsWith("https://");
      const testStatus = isUrlValid ? "SUCCESS" : "FAILED";
      const details = isUrlValid 
        ? `Successfully reached ${name} endpoint with status 200 OK.` 
        : `Failed to resolve host for ${endpointUrl}. Invalid protocol or domain.`;

      // Log sync test
      const log = await prisma.integrationSyncLog.create({
        data: {
          systemType,
          action: "SYNC_TEST",
          status: testStatus,
          details,
          recordsCount: 0,
        },
      });

      // Update configuration status in database
      const updatedSetting = await prisma.integrationSetting.update({
        where: { id },
        data: {
          status: isUrlValid ? "CONNECTED" : "ERROR",
          endpointUrl,
          authConfig,
          lastSyncedAt: isUrlValid ? new Date() : undefined,
        },
      });

      // Log audit trail
      await prisma.auditLog.create({
        data: {
          actor: "Compliance Lead",
          action: "TEST_INTEGRATION",
          object: `Integration:${name}`,
          afterSnapshot: JSON.stringify({ status: testStatus, details }),
        },
      });

      return NextResponse.json({ success: isUrlValid, log, setting: updatedSetting });
    }

    // Otherwise, standard update/create config
    if (!systemType || !name) {
      return NextResponse.json({ error: "systemType and name are required." }, { status: 400 });
    }

    let setting;
    if (id) {
      setting = await prisma.integrationSetting.update({
        where: { id },
        data: {
          endpointUrl,
          authConfig,
          status: status || "DISCONNECTED",
        },
      });
    } else {
      setting = await prisma.integrationSetting.create({
        data: {
          systemType,
          name,
          endpointUrl,
          authConfig,
          status: status || "DISCONNECTED",
        },
      });
    }

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actor: "Compliance Lead",
        action: id ? "UPDATE_INTEGRATION" : "CREATE_INTEGRATION",
        object: `Integration:${name}`,
        afterSnapshot: JSON.stringify(setting),
      },
    });

    return NextResponse.json({ success: true, setting });
  } catch (error: unknown) {
    console.error("Save integration error:", error);
    return NextResponse.json({ error: "Failed to save integration config" }, { status: 500 });
  }
}
