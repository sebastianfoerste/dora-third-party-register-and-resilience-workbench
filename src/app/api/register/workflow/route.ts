import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { runRegisterWorkflow } from "@/lib/register-workflow";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reviewerApproved = url.searchParams.get("reviewerApproved") === "true";

  const [vendors, contracts] = await Promise.all([
    prisma.vendor.findMany({
      include: {
        services: {
          include: {
            criticalityAssessments: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    }),
    prisma.contract.findMany({
      include: {
        registerEntries: true,
        clauseFindings: { include: { requirement: true } },
      },
    }),
  ]);

  const criticalityRank = { CRITICAL: 0, IMPORTANT: 1, NON_CRITICAL: 2 } as const;
  type Criticality = keyof typeof criticalityRank;

  const run = runRegisterWorkflow({
    runId: `register-workflow:${Date.now()}`,
    vendors: vendors.map((vendor) => {
      const allServicesAssessed =
        vendor.services.length > 0 &&
        vendor.services.every((service) => service.criticalityAssessments.length > 0);
      const mostSevere = vendor.services
        .map(
          (service) =>
            service.criticalityAssessments[0]?.result as Criticality | undefined,
        )
        .filter((result): result is Criticality => result !== undefined)
        .sort((left, right) => criticalityRank[left] - criticalityRank[right])[0];

      return {
        id: vendor.id,
        name: vendor.legalName,
        hasLegalEntity:
          vendor.services.length > 0 &&
          vendor.services.every((service) => Boolean(service.legalEntityId)),
        serviceCount: vendor.services.length,
        criticality: allServicesAssessed ? (mostSevere ?? null) : null,
      };
    }),
    contracts: contracts.map((contract) => ({
      id: contract.id,
      vendorId: contract.vendorId,
      hasRegisterEntry: contract.registerEntries.length > 0,
      missingHighSeverityFindings: contract.clauseFindings.filter(
        (finding) =>
          finding.status === "MISSING" && finding.requirement.severity === "HIGH",
      ).length,
    })),
    reviewerApproved,
  });

  return NextResponse.json(run);
}
