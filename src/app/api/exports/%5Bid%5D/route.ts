import { NextResponse } from "next/server";
import { buildBoardPack, buildBoardPackInputFromRegisterEntry, buildBoardPackManifest } from "@/lib/board-pack";
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

    const { searchParams } = new URL(req.url);
    if (searchParams.get("kind") === "board-pack") {
      return getBoardPackExport(id, searchParams.get("artifact"));
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
  } catch (error: unknown) {
    console.error("Retrieve export error:", error);
    return NextResponse.json({ error: "Server error retrieving export package details" }, { status: 500 });
  }
}

async function getBoardPackExport(registerEntryId: string, artifact?: string | null) {
  const entry = await prisma.registerEntry.findUnique({
    where: { id: registerEntryId },
    include: {
      vendor: true,
      service: {
        include: {
          exitPlan: true,
          exitPlanRehearsals: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          criticalityAssessments: true,
        },
      },
      contract: {
        include: {
          clauseFindings: {
            include: {
              requirement: true,
              remediationTasks: true,
            },
          },
        },
      },
    },
  });

  if (!entry) {
    return NextResponse.json({ error: "Register entry not found" }, { status: 404 });
  }

  const packet = buildBoardPack(buildBoardPackInputFromRegisterEntry(entry));
  const manifest = buildBoardPackManifest(packet);
  if (artifact === "manifest") {
    return NextResponse.json(manifest);
  }

  return NextResponse.json({
    packet,
    manifest,
  });
}
