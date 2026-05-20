import { prisma } from "@/lib/prisma";
import RegisterCockpit from "@/components/RegisterCockpit";

export const revalidate = 0; // Ensure data is loaded live on every page visit

export default async function RegisterPage() {
  // Query all register entries in DB
  const entries = await prisma.registerEntry.findMany({
    include: {
      legalEntity: true,
      vendor: true,
      service: true,
      contract: {
        include: {
          clauseFindings: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const legalEntities = await prisma.legalEntity.findMany();
  const vendors = await prisma.vendor.findMany();

  return (
    <RegisterCockpit
      initialEntries={entries as any}
      legalEntities={legalEntities}
      vendors={vendors}
    />
  );
}
