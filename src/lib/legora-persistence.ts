import { prisma } from "./prisma";
import {
  buildDemoLegoraWorkspace,
  type CollaborativeReviewWorkspace,
  type CommentStatus,
  type DocumentChangeSet,
  type RemediationList,
  type ReviewDecision,
} from "./legora-workspace";
import { buildDemoContractIntelligenceWorkspace } from "./contract-intelligence";

export class ReviewConflictError extends Error {}

const MATTER_ID = "synthetic:dora-contract-portfolio";
const ACTIVITY_EVENTS = new Set<CollaborativeReviewWorkspace["activity"][number]["event"]>([
  "comment_added",
  "comment_resolved",
  "locked",
  "reviewed",
  "lock",
  "assign",
  "decide",
  "comment",
  "resolve_comment",
  "remediation_resolved",
]);

function activityEvent(value: string): CollaborativeReviewWorkspace["activity"][number]["event"] {
  const normalized = value.toLowerCase() as CollaborativeReviewWorkspace["activity"][number]["event"];
  return ACTIVITY_EVENTS.has(normalized) ? normalized : "reviewed";
}

export async function ensurePersistedLegoraWorkspace() {
  const { vault, reviewTable } = buildDemoContractIntelligenceWorkspace();
  const demo = buildDemoLegoraWorkspace(vault, reviewTable);
  await prisma.$transaction(async (tx) => {
    for (const cell of demo.collaboration.cells) {
      await tx.collaborativeReviewCell.upsert({
        where: { id: cell.id },
        create: {
          id: cell.id,
          matterId: MATTER_ID,
          contractId: cell.documentId,
          requirementId: cell.requirementId,
        },
        update: {},
      });
    }
    const playbook = await tx.clausePlaybookVersion.upsert({
      where: { name_version: { name: "DORA Article 30 contract review", version: 1 } },
      create: {
        name: "DORA Article 30 contract review",
        version: 1,
        status: "active",
        activatedAt: new Date("2026-07-13T00:00:00Z"),
        rulesJson: JSON.stringify(demo.playbook),
      },
      update: {},
    });
    for (const document of vault.documents) {
      const documentChanges = demo.changeSet.changes.filter(
        (change) => change.documentId === document.id,
      );
      const existing = await tx.documentChangeSet.findFirst({
        where: { contractId: document.id, sourceDigest: demo.changeSet.sourceDigest },
      });
      if (!existing) {
        await tx.documentChangeSet.create({
          data: {
            contractId: document.id,
            sourceDigest: demo.changeSet.sourceDigest,
            playbookVersion: playbook.version,
            changesJson: JSON.stringify(documentChanges),
          },
        });
      }
    }
    for (const item of demo.remediationList.items) {
      await tx.remediationTask.upsert({
        where: { id: item.id },
        create: {
          id: item.id,
          title: item.title,
          description: `Dependencies: ${item.dependencies.join(", ")}`,
          owner: item.owner,
          dueDate: new Date(`${item.dueDate}T00:00:00Z`),
          severity: "HIGH",
          status: "OPEN",
        },
        update: {},
      });
    }
  });
}

export async function loadPersistedLegoraWorkspace() {
  await ensurePersistedLegoraWorkspace();
  const [cells, playbooks, changeSets, tasks, activity] = await Promise.all([
    prisma.collaborativeReviewCell.findMany({
      where: { matterId: MATTER_ID },
      include: { comments: { orderBy: { createdAt: "asc" } } },
      orderBy: { id: "asc" },
    }),
    prisma.clausePlaybookVersion.findMany({ orderBy: [{ name: "asc" }, { version: "asc" }] }),
    prisma.documentChangeSet.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.remediationTask.findMany({
      where: { id: { startsWith: "task:" } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { object: { startsWith: "LegoraWorkspace:" } },
      orderBy: { timestamp: "asc" },
    }),
  ]);
  return {
    collaboration: {
      schema: "review.collaboration.v1",
      matterId: MATTER_ID,
      cells: cells.map((cell) => ({
        id: cell.id,
        documentId: cell.contractId,
        requirementId: cell.requirementId,
        revision: cell.revision,
        reviewer: cell.reviewer,
        decision: cell.decision as ReviewDecision,
        lock: cell.lockedBy && cell.lockExpiresAt
          ? { actor: cell.lockedBy, expiresAt: cell.lockExpiresAt.toISOString(), revision: cell.revision }
          : null,
        comments: cell.comments.map((comment) => ({
          id: comment.id,
          targetId: cell.id,
          body: comment.body,
          author: comment.author,
          status: comment.status as CommentStatus,
          createdAt: comment.createdAt.toISOString(),
          resolvedAt: comment.resolvedAt?.toISOString() ?? null,
        })),
      })),
      activity: activity.map((event) => ({
        id: event.id,
        event: activityEvent(event.action),
        targetId: event.object.replace("LegoraWorkspace:", ""),
        actor: event.actor,
        occurredAt: event.timestamp.toISOString(),
      })),
    } satisfies CollaborativeReviewWorkspace,
    playbooks: playbooks.map((row) => ({
      id: row.id,
      name: row.name,
      version: row.version,
      status: row.status,
      rules: JSON.parse(row.rulesJson),
      activatedAt: row.activatedAt?.toISOString() ?? null,
    })),
    changeSets: changeSets.map((row) => ({
      id: row.id,
      contractId: row.contractId,
      sourceDigest: row.sourceDigest,
      playbookVersion: row.playbookVersion,
      reviewStatus: row.reviewStatus,
      revision: row.revision,
      changes: JSON.parse(row.changesJson) as DocumentChangeSet["changes"],
    })),
    remediationList: {
      schema: "dora.remediation-list.v1",
      items: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        owner: task.owner,
        dueDate: task.dueDate?.toISOString().slice(0, 10) ?? "",
        status: task.status === "RESOLVED" ? "resolved" : "blocked",
        evidenceRequired: true,
        evidenceRefs: task.resolutionEvidence ? JSON.parse(task.resolutionEvidence) : [],
        dependencies: task.description.replace("Dependencies: ", "").split(", ").filter(Boolean),
      })),
      overdue: tasks.filter((task) => task.status !== "RESOLVED" && task.dueDate && task.dueDate < new Date()).length,
      blocked: tasks.filter((task) => task.status !== "RESOLVED").length,
      externalDeliveryAllowed: false,
    } satisfies RemediationList,
  };
}

export async function mutatePersistedReview(input: {
  action: "lock" | "assign" | "decide" | "comment" | "resolve_comment" | "resolve_task" | "decide_change" | "activate_playbook";
  targetId: string;
  actor: string;
  expectedRevision?: number;
  value?: string;
  evidenceRefs?: string[];
}) {
  await ensurePersistedLegoraWorkspace();
  if (input.action === "activate_playbook") {
    if (!input.value?.trim()) throw new Error("A human review note is required for playbook activation.");
    await prisma.$transaction(async (tx) => {
      const playbook = await tx.clausePlaybookVersion.findUnique({ where: { id: input.targetId } });
      if (!playbook) throw new Error("Clause playbook version not found.");
      await tx.clausePlaybookVersion.updateMany({ where: { name: playbook.name }, data: { status: "retired" } });
      await tx.clausePlaybookVersion.update({ where: { id: playbook.id }, data: { status: "active", activatedAt: new Date() } });
      await tx.auditLog.create({ data: { actor: input.actor, action: "PLAYBOOK_ACTIVATED", object: `LegoraWorkspace:${playbook.id}`, afterSnapshot: JSON.stringify({ reviewNote: input.value }) } });
    });
    return loadPersistedLegoraWorkspace();
  }
  if (input.action === "decide_change") {
    if (input.expectedRevision === undefined || !input.value?.includes(":")) throw new Error("Change decision and expected revision are required.");
    const [changeId, decision] = input.value.split(":");
    if (!(["accepted", "rejected"] as const).includes(decision as "accepted" | "rejected")) throw new Error("Invalid change decision.");
    const row = await prisma.documentChangeSet.findUnique({ where: { id: input.targetId } });
    if (!row || row.revision !== input.expectedRevision) throw new ReviewConflictError("409 Conflict: stale change set revision");
    const changes = JSON.parse(row.changesJson) as DocumentChangeSet["changes"];
    const change = changes.find((candidate) => candidate.id === changeId);
    if (!change) throw new Error("Document change not found.");
    change.decision = decision as "accepted" | "rejected";
    const reviewStatus = changes.every((candidate) => candidate.decision !== "pending") ? "reviewed" : "pending";
    const updated = await prisma.documentChangeSet.updateMany({
      where: { id: row.id, revision: input.expectedRevision },
      data: { changesJson: JSON.stringify(changes), reviewStatus, reviewedAt: reviewStatus === "reviewed" ? new Date() : null, revision: { increment: 1 } },
    });
    if (updated.count !== 1) throw new ReviewConflictError("409 Conflict: stale change set revision");
    await prisma.auditLog.create({ data: { actor: input.actor, action: "CHANGE_DECIDED", object: `LegoraWorkspace:${row.id}`, afterSnapshot: JSON.stringify({ changeId, decision, revision: input.expectedRevision + 1 }) } });
    return loadPersistedLegoraWorkspace();
  }
  if (input.action === "resolve_task") {
    if (!input.evidenceRefs?.length) throw new Error("Resolution evidence is required.");
    await prisma.$transaction([
      prisma.remediationTask.update({
        where: { id: input.targetId },
        data: { status: "RESOLVED", resolutionEvidence: JSON.stringify(input.evidenceRefs) },
      }),
      prisma.auditLog.create({
        data: {
          actor: input.actor,
          action: "REMEDIATION_RESOLVED",
          object: `LegoraWorkspace:${input.targetId}`,
          afterSnapshot: JSON.stringify({ evidenceRefs: input.evidenceRefs }),
        },
      }),
    ]);
    return loadPersistedLegoraWorkspace();
  }
  if (input.expectedRevision === undefined) throw new Error("expectedRevision is required");
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const current = await tx.collaborativeReviewCell.findUnique({ where: { id: input.targetId } });
    if (!current || current.revision !== input.expectedRevision) {
      throw new ReviewConflictError("409 Conflict: stale review cell revision");
    }
    if (current.lockedBy && current.lockExpiresAt && current.lockExpiresAt > now && current.lockedBy !== input.actor) {
      throw new ReviewConflictError(`409 Conflict: review cell is locked by ${current.lockedBy}`);
    }
    const data = input.action === "lock"
      ? { lockedBy: input.actor, lockExpiresAt: new Date(now.getTime() + 15 * 60_000) }
      : input.action === "assign"
        ? { reviewer: input.value }
        : input.action === "decide"
          ? { decision: input.value, reviewedAt: now }
          : {};
    const updated = await tx.collaborativeReviewCell.updateMany({
      where: { id: input.targetId, revision: input.expectedRevision },
      data: { ...data, revision: { increment: 1 } },
    });
    if (updated.count !== 1) throw new ReviewConflictError("409 Conflict: stale review cell revision");
    if (input.action === "comment") {
      if (!input.value?.trim()) throw new Error("Comment body is required.");
      await tx.reviewComment.create({
        data: { cellId: input.targetId, body: input.value.trim(), author: input.actor },
      });
    }
    if (input.action === "resolve_comment") {
      const resolved = await tx.reviewComment.updateMany({
        where: { id: input.value, cellId: input.targetId },
        data: { status: "resolved", resolvedAt: now },
      });
      if (resolved.count !== 1) throw new Error("Review comment not found on the selected cell.");
    }
    await tx.auditLog.create({
      data: {
        actor: input.actor,
        action: input.action.toUpperCase(),
        object: `LegoraWorkspace:${input.targetId}`,
        afterSnapshot: JSON.stringify({ revision: input.expectedRevision + 1, value: input.value }),
      },
    });
  });
  return loadPersistedLegoraWorkspace();
}
