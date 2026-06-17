import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export async function GET() {
  try {
    const entities = await prisma.legalEntity.findMany({
      orderBy: {
        name: "asc",
      },
    });
    return NextResponse.json({ success: true, entities });
  } catch (error: unknown) {
    console.error("GET legal entities error:", error);
    return NextResponse.json({ error: "Failed to load legal entities" }, { status: 500 });
  }
}
