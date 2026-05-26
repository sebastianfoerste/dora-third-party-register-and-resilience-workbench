import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mkdir, copyFile } from "fs/promises";
import path from "path";

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

    // 3. Perform real file sync to local mock_dms_storage directory
    let auth = { folderId: "" };
    try {
      if (dmsSetting.authConfig) auth = JSON.parse(dmsSetting.authConfig);
    } catch (_) {}
    const folderId = auth.folderId || "dora_register_exports";

    const copiedFiles: string[] = [];
    for (const filePath of filesToSync) {
      try {
        const sourceFilename = path.basename(filePath);
        const sourcePath = path.join(process.cwd(), "public", "exports", sourceFilename);
        const targetDir = path.join(process.cwd(), "mock_dms_storage", folderId);
        await mkdir(targetDir, { recursive: true });
        const targetPath = path.join(targetDir, sourceFilename);
        await copyFile(sourcePath, targetPath);
        copiedFiles.push(sourceFilename);
      } catch (err: any) {
        console.warn(`Could not copy export file ${filePath}:`, err.message);
      }
    }

    // 4. Update last synced time
    await prisma.integrationSetting.update({
      where: { id: dmsSetting.id },
      data: { lastSyncedAt: new Date() },
    });

    // 5. Log the sync event
    await prisma.integrationSyncLog.create({
      data: {
        systemType: "DMS",
        action: "EXPORT",
        status: "SUCCESS",
        details: `Successfully copied ${copiedFiles.length} compliance files to local mock storage folder 'mock_dms_storage/${folderId}'. Files: ${copiedFiles.join(", ")}`,
        recordsCount: copiedFiles.length,
      },
    });

    // 6. Write audit log
    await prisma.auditLog.create({
      data: {
        actor: "Compliance Lead",
        action: "SYNC_DMS_FILES",
        object: `Integration:${dmsSetting.name}`,
        afterSnapshot: JSON.stringify({ syncedFiles: copiedFiles, folderId }),
      },
    });

    return NextResponse.json({
      success: true,
      filesSynced: copiedFiles,
      folderId
    });
  } catch (error: any) {
    console.error("DMS sync error:", error);
    return NextResponse.json({ error: "Server error during DMS upload sync" }, { status: 500 });
  }
}

