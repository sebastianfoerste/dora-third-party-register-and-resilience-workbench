CREATE TABLE "CollaborativeReviewCell" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "matterId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "requirementId" TEXT NOT NULL,
  "reviewer" TEXT,
  "decision" TEXT NOT NULL DEFAULT 'pending',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "lockedBy" TEXT,
  "lockExpiresAt" DATETIME,
  "reviewedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "CollaborativeReviewCell_contractId_requirementId_key" ON "CollaborativeReviewCell"("contractId", "requirementId");
CREATE INDEX "CollaborativeReviewCell_matterId_decision_idx" ON "CollaborativeReviewCell"("matterId", "decision");

CREATE TABLE "ReviewComment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cellId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" DATETIME,
  CONSTRAINT "ReviewComment_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "CollaborativeReviewCell"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReviewComment_cellId_status_idx" ON "ReviewComment"("cellId", "status");

CREATE TABLE "ClausePlaybookVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "rulesJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" DATETIME
);
CREATE UNIQUE INDEX "ClausePlaybookVersion_name_version_key" ON "ClausePlaybookVersion"("name", "version");

CREATE TABLE "DocumentChangeSet" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contractId" TEXT NOT NULL,
  "sourceDigest" TEXT NOT NULL,
  "playbookVersion" INTEGER NOT NULL,
  "changesJson" TEXT NOT NULL,
  "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" DATETIME
);
CREATE INDEX "DocumentChangeSet_contractId_createdAt_idx" ON "DocumentChangeSet"("contractId", "createdAt");
