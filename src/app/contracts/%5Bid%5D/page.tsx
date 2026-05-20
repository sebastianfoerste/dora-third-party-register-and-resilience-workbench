import { prisma } from "@/lib/prisma";
import ContractReview from "@/components/ContractReview";
import { notFound } from "next/navigation";

export const revalidate = 0; // Fresh load

type RouteParams = {
  params: Promise<{ id?: string }>;
};

export default async function ContractDetailPage({ params }: RouteParams) {
  const resolvedParams = await params;
  const { id } = resolvedParams;

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      vendor: true,
      legalEntity: true,
      clauseFindings: {
        include: {
          requirement: true,
        },
      },
    },
  });

  if (!contract) {
    return notFound();
  }

  return <ContractReview contract={contract as any} />;
}
