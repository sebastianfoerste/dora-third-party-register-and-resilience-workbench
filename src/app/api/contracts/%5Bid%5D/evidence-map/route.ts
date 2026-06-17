import { NextResponse } from "next/server";

import { buildContractEvidenceMap } from "@/lib/contract-evidence-map";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

type RouteParams = {
  params: Promise<{ id?: string }>;
};

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Contract id is required." }, { status: 400 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        clauseFindings: {
          include: {
            requirement: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      evidenceMap: buildContractEvidenceMap({ contract }),
    });
  } catch (error) {
    console.error("GET contract evidence map error:", error);
    return NextResponse.json({ error: "Failed to build contract evidence map." }, { status: 500 });
  }
}
