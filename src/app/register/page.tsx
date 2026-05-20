import { prisma } from "@/lib/prisma";
import RegisterCockpit from "@/components/RegisterCockpit";

export const revalidate = 0; // Ensure data is loaded live on every page visit

export default async function RegisterPage(props: { searchParams: Promise<{ entity?: string }> }) {
  const searchParams = await props.searchParams;
  const entityFilter = searchParams.entity || "all";

  // Query all register entries in DB
  const entries = await prisma.registerEntry.findMany({
    where: entityFilter !== "all" ? { legalEntityId: entityFilter } : {},
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
  const activeVendorIds = Array.from(new Set(entries.map((e) => e.vendorId)));
  const vendors = await prisma.vendor.findMany({
    where: entityFilter !== "all" ? { id: { in: activeVendorIds } } : {},
  });

  return (
    <RegisterCockpit
      initialEntries={entries as any}
      legalEntities={legalEntities}
      vendors={vendors}
    />
  );
}
