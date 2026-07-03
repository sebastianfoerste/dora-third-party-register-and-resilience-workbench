CREATE TABLE "ExitPlanRehearsal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "serviceId" TEXT NOT NULL,
  "scenarioType" TEXT NOT NULL,
  "assumptionsJson" TEXT NOT NULL,
  "outcomeJson" TEXT NOT NULL,
  "survivabilityScore" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "reviewer" TEXT,
  "approvedAt" DATETIME,
  "digest" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExitPlanRehearsal_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ICTService" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ExitPlanRehearsal_serviceId_createdAt_idx" ON "ExitPlanRehearsal"("serviceId", "createdAt");
CREATE INDEX "ExitPlanRehearsal_status_idx" ON "ExitPlanRehearsal"("status");
