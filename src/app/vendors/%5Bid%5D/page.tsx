import { prisma } from "@/lib/prisma";
import VendorProfile from "@/components/VendorProfile";
import { notFound } from "next/navigation";

export const revalidate = 0; // Fresh load

type RouteParams = {
  params: Promise<{ id?: string }>;
};

export default async function VendorDetailPage({ params }: RouteParams) {
  const resolvedParams = await params;
  const { id } = resolvedParams;

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      services: {
        include: {
          criticalityAssessments: {
            orderBy: { createdAt: "desc" },
          },
          subcontractors: true,
        },
      },
      threatIntel: {
        orderBy: { detectedAt: "desc" },
      },
    },
  });

  if (!vendor) {
    return notFound();
  }

  return <VendorProfile vendor={vendor as any} />;
}
