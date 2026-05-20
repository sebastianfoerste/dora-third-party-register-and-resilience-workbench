import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // 1. Verify DMS integration is connected
    const dmsSetting = await prisma.integrationSetting.findFirst({
      where: { systemType: "DMS" },
    });

    if (!dmsSetting || dmsSetting.status !== "CONNECTED") {
      return NextResponse.json({
        error: "DMS integration is not connected. Please enable it in the Hub."
      }, { status: 400 });
    }

    // 2. Fetch recent exports to upload
    const exports = await prisma.roIExport.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
    });

    if (exports.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No register exports found to synchronize. Please generate an export first.",
        filesSynced: []
      });
    }

    // Simulate network delay for uploading files
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Gather file names
    const filesToSync: string[] = [];
    exports.forEach((exp) => {
      try {
        const fileArr = JSON.parse(exp.generatedFiles);
        if (Array.isArray(fileArr)) {
          filesToSync.push(...fileArr);
        }
      } catch (_) {
        filesToSync.push(exp.generatedFiles);
      }
    });

    // 3. Update last synced time
    await prisma.integrationSetting.update({
      where: { id: dmsSetting.id },
      data: { lastSyncedAt: new Date() },
    });

    // 4. Log the sync event
    await prisma.integrationSyncLog.create({
      data: {
        systemType: "DMS",
        action: "EXPORT",
        status: "SUCCESS",
        details: `Successfully uploaded ${filesToSync.length} compliance documents to ${dmsSetting.name} folder ID '${JSON.parse(dmsSetting.authConfig || "{}").folderId || "dora_register_exports"}'. Files: ${filesToSync.join(", ")}`,
        recordsCount: filesToSync.length,
      },
    });

    // 5. Write audit log
    await prisma.auditLog.create({
      data: {
        actor: "Compliance Lead",
        action: "SYNC_DMS_FILES",
        object: `Integration:${dmsSetting.name}`,
        afterSnapshot: JSON.stringify({ syncedFiles: filesToSync }),
      },
    });

    return NextResponse.json({
      success: true,
      filesSynced: filesToSync,
      folderId: JSON.parse(dmsSetting.authConfig || "{}").folderId || "dora_register_exports"
    });
  } catch (error: any) {
    console.error("DMS sync error:", error);
    return NextResponse.json({ error: "Server error during DMS upload sync" }, { status: 500 });
  }
}
