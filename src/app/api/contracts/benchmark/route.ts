import { NextResponse } from "next/server";
import { buildClauseBenchmark } from "@/lib/clause-benchmark";
import { prisma } from "@/lib/prisma";
export async function GET() {
  try {
    const [requirements, findings] = await Promise.all([prisma.clauseRequirement.findMany(), prisma.clauseFinding.findMany({ include: { contract: { include: { vendor: true } } } })]);
    return NextResponse.json(buildClauseBenchmark({ requirements: requirements.map(req => ({ id: req.id, regulatoryBasis: req.regulatoryBasis, requirementName: req.requirementName, severity: req.severity as "HIGH" | "MEDIUM" | "LOW", applicability: req.applicability as "ALL_ICT" | "CRITICAL_ONLY" })), findings: findings.map(finding => ({ contractId: finding.contractId, vendorName: finding.contract.vendor.legalName, requirementId: finding.requirementId, status: finding.status as "PRESENT" | "MISSING" | "PARTIAL" | "UNCLEAR" | "NOT_APPLICABLE" | "UNREVIEWED", reviewerDecision: finding.reviewerDecision })) }));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "benchmark failed" }, { status: 500 }); }
}
