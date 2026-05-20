import { prisma } from "./prisma";
import { validateRegisterEntry } from "./validators";

export async function recalculateAllRegisters() {
  // 1. Load active policy settings from DB
  const dbSettings = await prisma.policySetting.findMany();
  const settingsMap: Record<string, string> = {};
  dbSettings.forEach((s) => {
    settingsMap[s.key] = s.value;
  });

  const options = {
    enforceEEADataResidency: settingsMap["enforce_eea_data_residency"] === "true",
    enforceEUGoverningLaw: settingsMap["enforce_eu_governing_law"] === "true",
    enforceExitPlan: settingsMap["enforce_exit_plan_for_critical_services"] === "true",
  };

  // 2. Fetch all register entries with relations
  const entries = await prisma.registerEntry.findMany({
    include: {
      legalEntity: true,
      vendor: true,
      service: true,
      contract: {
        include: {
          clauseFindings: {
            include: { requirement: true },
          },
        },
      },
    },
  });

  // 3. Re-validate each entry and update
  for (const entry of entries) {
    const findingsMapped = entry.contract
      ? entry.contract.clauseFindings.map((f) => ({
          requirementId: f.requirementId,
          requirementName: f.requirement.requirementName,
          status: f.status,
          severity: f.requirement.severity,
        }))
      : [];

    const valResult = validateRegisterEntry(
      {
        legalEntity: entry.legalEntity,
        vendor: entry.vendor,
        service: entry.service,
        contract: entry.contract,
        findings: findingsMapped,
        criticality: entry.criticality as any,
      },
      options
    );

    await prisma.registerEntry.update({
      where: { id: entry.id },
      data: {
        validationStatus: valResult.status,
        validationErrors: JSON.stringify(valResult.errors.map((e) => e.message)),
      },
    });
  }

  // 4. Log audit event
  await prisma.auditLog.create({
    data: {
      actor: "System Engine",
      action: "RECALCULATE_REGISTRY_COMPLIANCE",
      object: "All RegisterEntries",
      afterSnapshot: JSON.stringify(options),
    },
  });
}
