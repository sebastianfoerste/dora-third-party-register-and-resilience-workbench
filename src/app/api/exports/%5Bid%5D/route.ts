import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id?: string }>;
};

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    if (!id) {
      return NextResponse.json({ error: "Missing export ID" }, { status: 400 });
    }

    const roiExport = await prisma.roIExport.findUnique({
      where: { id },
    });

    if (!roiExport) {
      return NextResponse.json({ error: "Export package not found" }, { status: 404 });
    }

    // Parse safety fields
    let files: string[] = [];
    try {
      files = JSON.parse(roiExport.generatedFiles);
    } catch (_) {
      files = [roiExport.generatedFiles];
    }

    let warnings: string[] = [];
    try {
      if (roiExport.validationWarnings) {
        warnings = JSON.parse(roiExport.validationWarnings);
      }
    } catch (_) {}

    return NextResponse.json({
      id: roiExport.id,
      entityScope: roiExport.entityScope,
      exportFormat: roiExport.exportFormat,
      generatedFiles: files,
      validationWarnings: warnings,
      createdAt: roiExport.createdAt,
    });
  } catch (error: any) {
    console.error("Retrieve export error:", error);
    return NextResponse.json({ error: "Server error retrieving export package details" }, { status: 500 });
  }
}
