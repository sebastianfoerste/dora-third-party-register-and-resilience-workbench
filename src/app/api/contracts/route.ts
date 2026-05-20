import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      vendorId,
      legalEntityId,
      sourceFile,
      contractText,
      governingLaw,
      effectiveDate,
      renewalDate,
      terminationDate,
    } = body;

    if (!vendorId || !legalEntityId || !sourceFile) {
      return NextResponse.json(
        { error: "vendorId, legalEntityId, and sourceFile are required." },
        { status: 400 }
      );
    }

    const contract = await prisma.contract.create({
      data: {
        vendorId,
        legalEntityId,
        sourceFile,
        extractedText: contractText || "",
        governingLaw: governingLaw || "Unknown",
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        renewalDate: renewalDate ? new Date(renewalDate) : null,
        terminationDate: terminationDate ? new Date(terminationDate) : null,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actor: "Legal Reviewer",
        action: "UPLOAD_CONTRACT",
        object: `Contract:${contract.id}`,
        afterSnapshot: JSON.stringify({ sourceFile, vendorId, legalEntityId }),
      },
    });

    return NextResponse.json({ success: true, contract });
  } catch (error: any) {
    console.error("Contract upload error:", error);
    return NextResponse.json({ error: "Server error during contract creation" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const contracts = await prisma.contract.findMany({
      include: {
        vendor: true,
        legalEntity: true,
        clauseFindings: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(contracts);
  } catch (error: any) {
    console.error("Contracts list error:", error);
    return NextResponse.json({ error: "Server error retrieving contracts" }, { status: 500 });
  }
}
