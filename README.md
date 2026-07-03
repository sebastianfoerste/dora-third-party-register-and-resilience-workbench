# DORA Third-Party Register & Resilience Workbench

The DORA Resilience Workbench is a local-first legal engineering application built to manage ICT third-party risks under the Digital Operational Resilience Act (DORA - Regulation (EU) 2022/2554). It allows compliance teams to index ICT vendors, assess criticality, audit contract clauses, and compile regulatory register sheets.

---

## Core Features
- **GDPR & DORA Aligned Registers**: Compiles third-party registers matching DORA Article 30 requirements.
- **Contract Clause Audit**: Evaluates service level agreements (SLAs) and exit strategies against DORA contract mandates.
- **Criticality Triage**: Scores services to determine if they support "critical or important" business functions.
- **Threat Intelligence Log**: Indexes security feeds against active vendor structures to alert of potential risks.
- **Local DB Exporters**: Exports compliance registers to JSON or CSV formats.
- **Board Pack Proof Export**: Projects register entries into `dora-workbench.board-pack.v1` packets with review gates, remediation state, evidence references, and a local manifest digest. Raw contract excerpts are not copied into the packet.

---

## Tech Stack
- **Framework**: Next.js 16, React 19, TypeScript
- **Database / ORM**: Prisma Client, SQLite (`better-sqlite3`)
- **AI Analytics**: Google Gemini API via `@google/genai`
- **Testing**: Vitest, jsdom

---

## Repository Structure
- `src/`: Next.js pages, UI components, and API routing.
  - `src/app/`: App router page pages.
  - `src/components/`: Core UI components.
  - `src/lib/`: Database connections and AI helpers.
- `prisma/`: Prisma schema database models and seeding scripts.
- `docs/`: Repository markdown documentation guides.

---

## Setup & Running Instructions

Ensure Node.js (>= 20) is installed.

### 1. Install Dependencies
Run the install command:
```bash
npm install
```

### 2. Configure Environment Variables
Create a local `.env` file at the root:
```env
GEMINI_API_KEY="your_api_key_here"
DATABASE_URL="file:./prisma/dev.db"
```

### 3. Deploy Database Schema
Generate the client and deploy the local SQLite file:
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

### 4. Running the Development Server
```bash
npm run dev
# Starts Next.js on http://localhost:3000
```

---

## Development & Test Commands
- **Start dev server**: `npm run dev`
- **Run vitest tests**: `npm run test`
- **TypeScript checks**: `npm run typecheck`
- **Lint code**: `npm run lint`
- **Build application**: `npm run build`
- **Fast proof gate**: `npm run check:fast`

## Proof Surfaces
- `src/lib/board-pack.ts` contains the board pack and manifest projection used by `/api/exports/{registerEntryId}?kind=board-pack`.
- `src/lib/remediation-summary.ts` keeps unresolved remediation, missing owners, and closure evidence gaps visible for management exports.
- `docs/board-pack-export-contract.md` describes the export contract and the review boundaries.
