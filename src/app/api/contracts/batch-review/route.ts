import { NextResponse } from "next/server";

import { buildBatchReview } from "@/lib/batch-review";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const rawName =
      typeof body === "object" && body !== null && "name" in body
        ? (body as { name?: unknown }).name
        : undefined;
    const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : null;
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const [contracts, requirements] = await Promise.all([
      prisma.contract.findMany({ include: { vendor: true, clauseFindings: true } }),
      prisma.clauseRequirement.findMany(),
    ]);
    const result = buildBatchReview({
      runName: name,
      matterId: `batch:${name}`,
      contracts: contracts.map((contract) => ({
        id: contract.id,
        vendorId: contract.vendorId,
        vendorName: contract.vendor.legalName,
        sourceFile: contract.sourceFile,
        hasProvenance: contract.provenanceMap !== null,
        findings: contract.clauseFindings.map((finding) => ({
          requirementId: finding.requirementId,
          status: finding.status,
          extractedEvidence: finding.extractedEvidence,
        })),
      })),
      requirements: requirements.map((requirement) => ({
        id: requirement.id,
        requirementName: requirement.requirementName,
        regulatoryBasis: requirement.regulatoryBasis,
        applicability: requirement.applicability,
      })),
    });

    const run = await prisma.batchReviewRun.create({
      data: {
        name,
        contractCount: result.contractCount,
        blockerCount: result.blockerCount,
        tableJson: JSON.stringify(result),
      },
    });
    await prisma.auditLog.create({
      data: {
        actor: "Legal Reviewer",
        action: "BATCH_REVIEW_RUN",
        object: `BatchReviewRun:${run.id}`,
        afterSnapshot: JSON.stringify({
          name,
          contractCount: result.contractCount,
          blockerCount: result.blockerCount,
        }),
      },
    });

    return NextResponse.json({ runId: run.id, ...result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "batch review failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const runs = await prisma.batchReviewRun.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      contractCount: true,
      blockerCount: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ runs });
}
