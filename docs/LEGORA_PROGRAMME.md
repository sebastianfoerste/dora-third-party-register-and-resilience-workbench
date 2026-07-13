# Legora-inspired programme

The contract-intelligence workspace persists multi-contract review cells, assignments, comments, locks, decisions, playbook versions, document change sets, remediation tasks and audit activity through Prisma and SQLite. The `/contract-intelligence` interface calls `/api/legora/workspace` for all collaboration mutations.

Review and change-set mutations require expected revisions and return HTTP 409 for stale or conflicting writes. Remediation cannot resolve without evidence. `/api/legora/docx` checks the source digest, preserves the uploaded DOCX package and writes accepted tracked changes only. Rejected changes never enter the reviewed output.

Run `npm run check:fast`, `npm run migration:current` and `npm run build`. The empty-database history is covered by `npm run migration:smoke`. The fixture contracts are synthetic and the workspace has no external delivery route.
