# DORA Third-Party Register and Resilience Workbench

A supervised legal engineering prototype for DORA third-party ICT risk governance.

The workbench helps regulated financial entities structure ICT provider records, map critical functions, track resilience obligations, prepare review workflows and maintain audit-ready evidence.

## Why this matters

DORA turns outsourcing and ICT risk into a continuously governed data problem. Legal review alone is not enough. Firms need structured registers, review states, escalation rules, evidence trails and human sign-off.

## Current scope

* ICT third-party register model
* Provider and service records
* Criticality classification workflow
* Review states and evidence fields
* Local-first prototype
* No client data
* No legal advice

## Workflow

```mermaid
flowchart TD
  A[Provider record] --> B[ICT service mapping]
  B --> C[Function and criticality assessment]
  C --> D[Evidence collection]
  D --> E[Reviewer queue]
  E --> F{Approved?}
  F -- No --> G[Gap or follow-up action]
  F -- Yes --> H[Audit-ready register]
```

## What this proves

* Financial regulation is increasingly a workflow and data architecture challenge.
* Legal engineers can translate regulatory obligations into operational systems.
* DORA implementation benefits from product thinking: register, review state, evidence, decision and escalation.

## Stack

* Next.js 16
* React 19
* TypeScript
* Prisma
* SQLite for local prototype storage
* Vitest

## Commands

```bash
npm run dev
npm run lint
npm run test
npm run build
```

## Safety note

This repository is a prototype. It does not provide legal advice and should not be used for production DORA compliance without professional review, security hardening and organisation-specific validation.


## ⚠️ System Disclaimers & Regulatory Compliance

### 1. Decoupled AI Architecture
This system is structured as an autonomous multi-agent pipeline using Large Language Models (LLMs) to automate processing, information retrieval, and synthesis. It functions via a decoupled architecture consisting of specialized agent personas (e.g., scoring, profiling, outreach drafts, translation) communicating asynchronously.

### 2. Operational Limits & Hallucinations
- **Accuracy Constraints**: Output generation is subject to LLM limitations. This includes potential hallucinations, logical inconsistencies, and processing lag.
- **Data Latency**: Vector store updates and local database states are updated periodically and do not reflect real-time regulatory or institutional shifts.

### 3. Mandatory Human-in-the-Loop Review
**CRITICAL**: Under no circumstances should any raw output (including client profiles, generated LinkedIn posts, email sequences, or automated outreach drafts) be sent, published, or finalized without thorough human validation. The operator retains sole responsibility for reviewing and verifying the accuracy and appropriateness of all generated artifacts.

### 4. No Legal Advice Framing
**This software does not provide legal representation or binding legal counsel.** All synthesized analyses, regulatory scans, contract clause comparisons, and case triage scores are for administrative automation and operational assistance only. This tool is not a licensed attorney, does not operate as a law firm, and does not establish any attorney-client relationship. Operators must consult qualified legal professionals for binding advice or representation.
