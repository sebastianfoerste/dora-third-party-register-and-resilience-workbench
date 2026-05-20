import { prisma } from "@/lib/prisma";
import ExportCenter from "@/components/ExportCenter";

export const revalidate = 0; // Fresh load

export default async function ExportsPage() {
  const exportsList = await prisma.roIExport.findMany({
    orderBy: { createdAt: "desc" },
  });

  const legalEntities = await prisma.legalEntity.findMany();
  const entriesCount = await prisma.registerEntry.count();

  return (
    <ExportCenter
      initialExports={exportsList as any}
      legalEntities={legalEntities}
      entriesCount={entriesCount}
    />
  );
}
