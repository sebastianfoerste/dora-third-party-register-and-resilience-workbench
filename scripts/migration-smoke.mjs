import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "dora-migrations-"));
const database = new DatabaseSync(join(directory, "audit.db"));
try {
  database.exec("PRAGMA foreign_keys = ON");
  const migrations = readdirSync("prisma/migrations", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const migration of migrations) {
    database.exec(readFileSync(join("prisma/migrations", migration, "migration.sql"), "utf8"));
  }
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
    .map((row) => row.name);
  for (const required of ["Contract", "CollaborativeReviewCell", "ReviewComment", "DocumentChangeSet"]) {
    if (!tables.includes(required)) throw new Error(`migration history is missing ${required}`);
  }
  console.log(`applied ${migrations.length} migrations to an empty SQLite database`);
} finally {
  database.close();
  rmSync(directory, { recursive: true, force: true });
}
