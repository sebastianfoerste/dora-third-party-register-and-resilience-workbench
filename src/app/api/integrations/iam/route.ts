import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/integrations/iam
export async function GET() {
  try {
    const iamSetting = await prisma.integrationSetting.findFirst({
      where: { systemType: "IAM" },
    });

    if (!iamSetting) {
      return NextResponse.json({ error: "IAM Integration not seeded." }, { status: 404 });
    }

    return NextResponse.json({ setting: iamSetting });
  } catch (error: any) {
    console.error("IAM fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch IAM settings" }, { status: 500 });
  }
}

// POST /api/integrations/iam
export async function POST(req: Request) {
  try {
    const iamSetting = await prisma.integrationSetting.findFirst({
      where: { systemType: "IAM" },
    });

    if (!iamSetting || iamSetting.status !== "CONNECTED") {
      return NextResponse.json({
        error: "IAM connector is not connected. Please save configuration settings first."
      }, { status: 400 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "SYNC_GROUPS") {
      // Simulate sync users from Okta
      await new Promise((resolve) => setTimeout(resolve, 800));

      const config = JSON.parse(iamSetting.authConfig || "{}");
      const mappings = config.groupMapping || [];

      let userCount = 0;
      const mappingLogs: string[] = [];
      
      mappings.forEach((m: any) => {
        // Mock import count based on group
        const count = m.group.includes("CCO") ? 2 : 12;
        userCount += count;
        mappingLogs.push(`${count} users from Okta group '${m.group}' mapped to system role '${m.role}'`);
      });

      // Update sync time
      await prisma.integrationSetting.update({
        where: { id: iamSetting.id },
        data: { lastSyncedAt: new Date() },
      });

      // Log in DB
      await prisma.integrationSyncLog.create({
        data: {
          systemType: "IAM",
          action: "IMPORT",
          status: "SUCCESS",
          details: `SSO synchronization successful. ${mappingLogs.join("; ")}. Total ${userCount} active compliance accounts provisioned.`,
          recordsCount: userCount,
        },
      });

      await prisma.auditLog.create({
        data: {
          actor: "IAM Sync Service",
          action: "IAM_USER_SYNC",
          object: `Integration:${iamSetting.name}`,
          afterSnapshot: JSON.stringify({ usersProvisioned: userCount, mappings }),
        },
      });

      return NextResponse.json({
        success: true,
        userCount,
        mappings
      });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error: any) {
    console.error("IAM sync error:", error);
    return NextResponse.json({ error: "Server error during SSO group mapping sync" }, { status: 500 });
  }
}
