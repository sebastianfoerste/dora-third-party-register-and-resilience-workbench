import { createHash } from "node:crypto";

import type { ClauseReviewTable, ContractVault } from "./contract-intelligence";

export type ReviewDecision = "pending" | "accepted" | "rejected";
export type CommentStatus = "open" | "resolved";

export interface ReviewComment {
  id: string;
  targetId: string;
  body: string;
  author: string;
  status: CommentStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CollaborativeReviewCell {
  id: string;
  documentId: string;
  requirementId: string;
  revision: number;
  reviewer: string | null;
  decision: ReviewDecision;
  lock: { actor: string; expiresAt: string; revision: number } | null;
  comments: ReviewComment[];
}

export interface CollaborativeReviewWorkspace {
  schema: "review.collaboration.v1";
  matterId: string;
  cells: CollaborativeReviewCell[];
  activity: Array<{
    id: string;
    event: "comment_added" | "comment_resolved" | "locked" | "reviewed";
    targetId: string;
    actor: string;
    occurredAt: string;
  }>;
}

export interface ClausePlaybookRule {
  id: string;
  version: number;
  requirementId: string;
  preferredClause: string;
  fallbacks: string[];
  unacceptableWording: string[];
  sourceRefs: string[];
  escalation: string;
}

export interface DocumentChange {
  id: string;
  documentId: string;
  locator: string;
  originalText: string;
  proposedText: string;
  rationale: string;
  sourceRefs: string[];
  decision: ReviewDecision;
}

export interface DocumentChangeSet {
  schema: "document.change-set.v1";
  sourceDigest: string;
  playbookVersion: number;
  changes: DocumentChange[];
  sourcePreserved: true;
  exportAllowed: boolean;
}

export interface RemediationListItem {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  status: "blocked" | "awaiting_counterparty" | "ready_for_approval" | "resolved";
  evidenceRequired: boolean;
  evidenceRefs: string[];
  dependencies: string[];
}

export interface RemediationList {
  schema: "dora.remediation-list.v1";
  items: RemediationListItem[];
  overdue: number;
  blocked: number;
  externalDeliveryAllowed: false;
}

function stableCellId(documentId: string, requirementId: string) {
  return `cell:${documentId}:${requirementId}`;
}

export function buildCollaborativeReview(
  vault: ContractVault,
  table: ClauseReviewTable,
): CollaborativeReviewWorkspace {
  return {
    schema: "review.collaboration.v1",
    matterId: vault.matterId,
    cells: table.rows.flatMap((row) =>
      row.cells.map((cell) => ({
        id: stableCellId(row.documentId, cell.columnId),
        documentId: row.documentId,
        requirementId: cell.columnId,
        revision: 1,
        reviewer: null,
        decision: "pending" as const,
        lock: null,
        comments: [],
      })),
    ),
    activity: [],
  };
}

export function lockReviewCell(input: {
  workspace: CollaborativeReviewWorkspace;
  cellId: string;
  actor: string;
  expectedRevision: number;
  now: Date;
}): CollaborativeReviewWorkspace {
  const cell = input.workspace.cells.find((candidate) => candidate.id === input.cellId);
  if (!cell) throw new Error(`Unknown review cell: ${input.cellId}`);
  if (cell.revision !== input.expectedRevision) {
    throw new Error(`409 Conflict: expected revision ${input.expectedRevision}, received ${cell.revision}.`);
  }
  if (cell.lock && new Date(cell.lock.expiresAt) > input.now && cell.lock.actor !== input.actor) {
    throw new Error(`409 Conflict: review cell is locked by ${cell.lock.actor}.`);
  }
  const occurredAt = input.now.toISOString();
  const expiresAt = new Date(input.now.getTime() + 15 * 60_000).toISOString();
  return {
    ...input.workspace,
    cells: input.workspace.cells.map((candidate) =>
      candidate.id === cell.id
        ? { ...candidate, revision: candidate.revision + 1, lock: { actor: input.actor, expiresAt, revision: candidate.revision + 1 } }
        : candidate,
    ),
    activity: [...input.workspace.activity, { id: `activity:${input.workspace.activity.length + 1}`, event: "locked", targetId: cell.id, actor: input.actor, occurredAt }],
  };
}

export function buildChangeSet(input: {
  vault: ContractVault;
  table: ClauseReviewTable;
  playbook: ClausePlaybookRule[];
}): DocumentChangeSet {
  const sourceDigest = createHash("sha256")
    .update(JSON.stringify(input.vault.documents.map(({ id, sourceRef, clauses }) => ({ id, sourceRef, clauses }))))
    .digest("hex");
  const changes: DocumentChange[] = input.table.rows.flatMap((row) =>
    row.cells
      .filter((cell) => cell.status !== "pass")
      .map((cell) => {
        const rule = input.playbook.find((candidate) => candidate.requirementId === cell.columnId);
        if (!rule) throw new Error(`Missing playbook rule for ${cell.columnId}.`);
        return {
          id: `change:${row.documentId}:${cell.columnId}`,
          documentId: row.documentId,
          locator: `clause:${cell.columnId}`,
          originalText: cell.status === "missing" ? "" : cell.value,
          proposedText: rule.preferredClause,
          rationale: rule.escalation,
          sourceRefs: rule.sourceRefs,
          decision: "pending" as const,
        };
      }),
  );
  return {
    schema: "document.change-set.v1",
    sourceDigest,
    playbookVersion: Math.max(...input.playbook.map((rule) => rule.version)),
    changes,
    sourcePreserved: true,
    exportAllowed: changes.length > 0 && changes.every((change) => change.decision === "accepted"),
  };
}

export function decideChange(
  changeSet: DocumentChangeSet,
  changeId: string,
  decision: Exclude<ReviewDecision, "pending">,
): DocumentChangeSet {
  if (!changeSet.changes.some((change) => change.id === changeId)) throw new Error(`Unknown change: ${changeId}`);
  const changes = changeSet.changes.map((change) => (change.id === changeId ? { ...change, decision } : change));
  return { ...changeSet, changes, exportAllowed: changes.length > 0 && changes.every((change) => change.decision === "accepted") };
}

export async function renderReviewedDocx(input: {
  title: string;
  changeSet: DocumentChangeSet;
}): Promise<Uint8Array> {
  if (!input.changeSet.exportAllowed) throw new Error("Reviewed DOCX export requires every change to be accepted.");
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
  const document = new Document({
    sections: [{
      children: [
        new Paragraph({ text: input.title, heading: HeadingLevel.TITLE }),
        ...input.changeSet.changes.flatMap((change) => [
          new Paragraph({ children: [new TextRun({ text: change.locator, bold: true })] }),
          new Paragraph({ children: [new TextRun(change.proposedText)] }),
          new Paragraph({ children: [new TextRun({ text: `Basis: ${change.sourceRefs.join(", ")}`, italics: true })] }),
        ]),
      ],
    }],
  });
  return new Uint8Array(await Packer.toBuffer(document));
}

export function buildRemediationList(input: {
  table: ClauseReviewTable;
  owner: string;
  dueDate: string;
  today: string;
}): RemediationList {
  const items: RemediationListItem[] = input.table.rows.flatMap((row) =>
    row.cells
      .filter((cell) => cell.status !== "pass")
      .map((cell) => ({
        id: `task:${row.documentId}:${cell.columnId}`,
        title: `${row.vendorName}: remediate ${cell.columnId.replaceAll("_", " ")}`,
        owner: input.owner,
        dueDate: input.dueDate,
        status: "blocked" as const,
        evidenceRequired: true,
        evidenceRefs: [],
        dependencies: [`cell:${row.documentId}:${cell.columnId}`],
      })),
  );
  return {
    schema: "dora.remediation-list.v1",
    items,
    overdue: items.filter((item) => item.dueDate < input.today && item.status !== "resolved").length,
    blocked: items.filter((item) => item.status === "blocked").length,
    externalDeliveryAllowed: false,
  };
}

export function resolveRemediationItem(list: RemediationList, itemId: string, evidenceRefs: string[]): RemediationList {
  if (evidenceRefs.length === 0) throw new Error("Resolution evidence is required.");
  if (!list.items.some((item) => item.id === itemId)) throw new Error(`Unknown remediation item: ${itemId}`);
  const items = list.items.map((item) => item.id === itemId ? { ...item, status: "resolved" as const, evidenceRefs } : item);
  return { ...list, items, blocked: items.filter((item) => item.status === "blocked").length };
}

export function buildDemoLegoraWorkspace(vault: ContractVault, table: ClauseReviewTable) {
  const playbook: ClausePlaybookRule[] = table.columns.map((column) => ({
    id: `playbook:${column.id}`,
    version: 1,
    requirementId: column.id,
    preferredClause: `The provider shall maintain a documented ${column.label.toLowerCase()} control and provide evidence on request.`,
    fallbacks: ["Escalate a time-limited remediation commitment for legal approval."],
    unacceptableWording: ["commercially reasonable efforts only"],
    sourceRefs: [column.citation],
    escalation: `Legal review required under ${column.citation}.`,
  }));
  return {
    collaboration: buildCollaborativeReview(vault, table),
    changeSet: buildChangeSet({ vault, table, playbook }),
    remediationList: buildRemediationList({ table, owner: "ICT Third-Party Risk", dueDate: "2026-08-31", today: "2026-07-13" }),
  };
}
