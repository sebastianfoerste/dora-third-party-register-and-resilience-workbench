import { prisma } from "@/lib/prisma";
import RemediationBoard from "@/components/RemediationBoard";

export const revalidate = 0; // Fresh load

export default async function RemediationPage() {
  const tasks = await prisma.remediationTask.findMany({
    include: {
      finding: {
        include: {
          contract: {
            include: {
              vendor: true,
            },
          },
          requirement: true,
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  return <RemediationBoard initialTasks={tasks} />;
}
