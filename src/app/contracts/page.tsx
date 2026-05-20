import { prisma } from "@/lib/prisma";
import ContractIngestion from "@/components/ContractIngestion";

export const revalidate = 0; // Fresh load on each request

export default async function ContractsPage() {
  const contracts = await prisma.contract.findMany({
    include: {
      vendor: true,
      legalEntity: true,
      clauseFindings: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const vendors = await prisma.vendor.findMany();
  const legalEntities = await prisma.legalEntity.findMany();

  return (
    <ContractIngestion
      initialContracts={contracts as any}
      vendors={vendors}
      legalEntities={legalEntities}
    />
  );
}
