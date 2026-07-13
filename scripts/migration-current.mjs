import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const databasePath = resolve(process.env.DORA_DATABASE_PATH || "prisma/dev.db");
const database = new DatabaseSync(databasePath);
try {
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("CREATE TABLE IF NOT EXISTS _legora_migrations (name TEXT PRIMARY KEY, appliedAt TEXT NOT NULL)");
  const migrations = readdirSync("prisma/migrations", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const existing = new Set(database.prepare("SELECT name FROM _legora_migrations").all().map((row) => row.name));
  const userTables = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_legora_migrations'").all();
  if (userTables.length > 0 && existing.size === 0) {
    throw new Error("Refusing to apply an untracked migration history to a non-empty SQLite database.");
  }
  for (const migration of migrations) {
    if (existing.has(migration)) continue;
    const path = join("prisma/migrations", migration, "migration.sql");
    if (!existsSync(path)) throw new Error(`missing migration SQL: ${migration}`);
    database.exec("BEGIN");
    try {
      database.exec(readFileSync(path, "utf8"));
      database.prepare("INSERT INTO _legora_migrations (name, appliedAt) VALUES (?, ?)").run(migration, new Date().toISOString());
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
  console.log(`current SQLite database has ${migrations.length} tracked migrations: ${databasePath}`);
} finally {
  database.close();
}
