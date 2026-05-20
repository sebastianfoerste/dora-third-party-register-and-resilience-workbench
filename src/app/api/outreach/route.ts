import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export async function GET() {
  try {
    const vendors = await prisma.vendor.findMany({
      include: {
        contracts: {
          include: {
            clauseFindings: {
              include: {
                requirement: true,
              },
            },
          },
        },
        services: true,
      },
      orderBy: {
        legalName: "asc",
      },
    });

    return NextResponse.json({ success: true, vendors });
  } catch (error: any) {
    console.error("GET outreach vendors error:", error);
    return NextResponse.json({ error: "Failed to load outreach metrics" }, { status: 500 });
  }
}
