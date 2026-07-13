-- CreateTable
CREATE TABLE "LegalEntity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "lei" TEXT,
    "jurisdiction" TEXT NOT NULL,
    "regulatedStatus" BOOLEAN NOT NULL DEFAULT true,
    "licenceType" TEXT NOT NULL,
    "competentAuthority" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legalName" TEXT NOT NULL,
    "groupName" TEXT,
    "country" TEXT NOT NULL,
    "lei" TEXT,
    "serviceCategories" TEXT NOT NULL,
    "concentrationTags" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ICTService" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "serviceDescription" TEXT NOT NULL,
    "supportedFunction" TEXT NOT NULL,
    "dataProcessed" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "subcontractingStatus" TEXT NOT NULL,
    "subcontractorDetails" TEXT,
    "substitutability" TEXT NOT NULL,
    "exitPlanStatus" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ICTService_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ICTService_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "effectiveDate" DATETIME,
    "renewalDate" DATETIME,
    "terminationDate" DATETIME,
    "governingLaw" TEXT NOT NULL,
    "extractedText" TEXT,
    "provenanceMap" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contract_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Contract_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CriticalityAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT NOT NULL,
    "function" TEXT NOT NULL,
    "scoringInputs" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "reviewer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "evidence" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CriticalityAssessment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ICTService" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClauseRequirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "regulatoryBasis" TEXT NOT NULL,
    "requirementName" TEXT NOT NULL,
    "applicability" TEXT NOT NULL,
    "expectedPattern" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ClauseFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNREVIEWED',
    "extractedEvidence" TEXT,
    "confidence" REAL NOT NULL,
    "reviewerDecision" TEXT,
    "reviewerComments" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClauseFinding_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClauseFinding_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "ClauseRequirement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegisterEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legalEntityId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "contractId" TEXT,
    "criticality" TEXT NOT NULL,
    "mandatoryFields" TEXT NOT NULL,
    "validationStatus" TEXT NOT NULL,
    "validationErrors" TEXT,
    "lastReviewedAt" DATETIME,
    "nextReviewDue" DATETIME,
    "reviewerNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RegisterEntry_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RegisterEntry_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RegisterEntry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ICTService" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RegisterEntry_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoIExport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityScope" TEXT NOT NULL,
    "exportFormat" TEXT NOT NULL,
    "generatedFiles" TEXT NOT NULL,
    "validationWarnings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RemediationTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "findingId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "dueDate" DATETIME,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolutionEvidence" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RemediationTask_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "ClauseFinding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "object" TEXT NOT NULL,
    "beforeSnapshot" TEXT,
    "afterSnapshot" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Subcontractor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lei" TEXT,
    "country" TEXT NOT NULL,
    "serviceDescription" TEXT NOT NULL,
    "criticality" TEXT NOT NULL DEFAULT 'NON_CRITICAL',
    "location" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subcontractor_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ICTService" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExitPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "testedDate" DATETIME,
    "alternativeVendor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewer" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExitPlan_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ICTService" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IncidentLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "incidentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "remediationAction" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IncidentLog_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ICTService" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolicySetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ResilienceTest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "testDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "findingsCount" INTEGER NOT NULL DEFAULT 0,
    "evidenceSummary" TEXT NOT NULL,
    "nextScheduledDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResilienceTest_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ICTService" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registerEntryId" TEXT NOT NULL,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewer" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    CONSTRAINT "ReviewCycle_registerEntryId_fkey" FOREIGN KEY ("registerEntryId") REFERENCES "RegisterEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntegrationSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "systemType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "endpointUrl" TEXT,
    "authConfig" TEXT,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IntegrationSyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "systemType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "details" TEXT,
    "recordsCount" INTEGER NOT NULL DEFAULT 0,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ThreatIntel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "cveId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ThreatIntel_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SimulationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "survivability" INTEGER NOT NULL,
    "timelineLog" TEXT NOT NULL,
    "testedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ExitPlan_serviceId_key" ON "ExitPlan"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicySetting_key_key" ON "PolicySetting"("key");
