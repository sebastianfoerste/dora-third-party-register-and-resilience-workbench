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
    event:
      | "comment_added"
      | "comment_resolved"
      | "locked"
      | "reviewed"
      | "lock"
      | "assign"
      | "decide"
      | "comment"
      | "resolve_comment"
      | "remediation_resolved";
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
  return {
    ...changeSet,
    changes,
    exportAllowed:
      changes.length > 0 && changes.every((change) => change.decision !== "pending"),
  };
}

export async function renderReviewedDocx(input: {
  source: Uint8Array;
  changeSet: DocumentChangeSet;
}): Promise<Uint8Array> {
  if (!input.changeSet.exportAllowed) {
    throw new Error("Reviewed DOCX export requires every change to be decided.");
  }
  const digest = createHash("sha256").update(input.source).digest("hex");
  if (digest !== input.changeSet.sourceDigest) {
    throw new Error("Source DOCX digest does not match the reviewed change set.");
  }
  const { default: JSZip } = await import("jszip");
  const archive = await JSZip.loadAsync(input.source);
  const documentFile = archive.file("word/document.xml");
  if (!documentFile) throw new Error("Source DOCX is missing word/document.xml.");
  let documentXml = await documentFile.async("string");
  const acceptedChanges = input.changeSet.changes.filter(
    (change) => change.decision === "accepted",
  );
  const tracked = acceptedChanges
    .map((change, index) => {
      const xml = (value: string) => value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
      return `<w:p><w:del w:id="${index * 2}" w:author="DORA reviewer" w:date="2026-07-13T00:00:00Z"><w:r><w:delText>${xml(change.originalText || "Missing clause")}</w:delText></w:r></w:del><w:ins w:id="${index * 2 + 1}" w:author="DORA reviewer" w:date="2026-07-13T00:00:00Z"><w:r><w:t>${xml(change.proposedText)}</w:t></w:r></w:ins></w:p>`;
    })
    .join("");
  const marker = documentXml.includes("<w:sectPr") ? "<w:sectPr" : "</w:body>";
  documentXml = documentXml.replace(marker, `${tracked}${marker}`);
  archive.file("word/document.xml", documentXml);
  return new Uint8Array(await archive.generateAsync({ type: "uint8array" }));
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
    playbook,
  };
}
