import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { DB_PATH } from "./paths";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  _db = db;
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      project_id TEXT PRIMARY KEY,
      original_path TEXT NOT NULL,
      dir_path TEXT NOT NULL,
      last_indexed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_mtime INTEGER NOT NULL,
      file_size INTEGER NOT NULL,
      is_sidechain INTEGER NOT NULL DEFAULT 0,
      parent_session_id TEXT,
      agent_id TEXT,
      cwd TEXT,
      git_branch TEXT,
      model TEXT,
      version TEXT,
      ai_title TEXT,
      first_prompt TEXT,
      summary TEXT,
      message_count INTEGER,
      turn_count INTEGER,
      first_ts TEXT,
      last_ts TEXT,
      last_user_ts TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(project_id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_last_ts ON sessions(last_ts DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_parent ON sessions(parent_session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_sidechain ON sessions(is_sidechain);

    CREATE TABLE IF NOT EXISTS turns (
      session_id TEXT NOT NULL,
      turn_index INTEGER NOT NULL,
      role TEXT NOT NULL,
      ts TEXT,
      byte_start INTEGER NOT NULL,
      byte_end INTEGER NOT NULL,
      summary TEXT,
      has_thinking INTEGER NOT NULL DEFAULT 0,
      tool_names TEXT,
      subagent_session_ids TEXT,
      PRIMARY KEY(session_id, turn_index)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
      session_id UNINDEXED,
      summary,
      first_prompt,
      ai_title,
      git_branch,
      original_path,
      tokenize = 'porter unicode61'
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Add columns introduced after the initial schema.
  addColumnIfMissing(db, "sessions", "last_user_ts", "TEXT");
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_last_user_ts ON sessions(last_user_ts DESC);`);
  runOnce(db, "backfill_last_user_ts_v1", () => {
    db.exec(`
      UPDATE sessions
         SET last_user_ts = (
           SELECT MAX(t.ts) FROM turns t
            WHERE t.session_id = sessions.session_id AND t.role = 'user'
         )
       WHERE last_user_ts IS NULL
    `);
  });

  // The original indexer derived projects.original_path from a lossy
  // hyphen→slash decoding (or sessions-index.json, which is also wrong for
  // paths that legitimately contain hyphens). Each session's cwd, however,
  // is authoritative and round-trips back to the encoded project folder.
  // Fix existing rows and rebuild FTS so the corrected path is searchable.
  runOnce(db, "fix_project_paths_from_cwd_v1", () => {
    db.exec(`
      UPDATE projects
         SET original_path = (
           SELECT s.cwd FROM sessions s
            WHERE s.project_id = projects.project_id
              AND s.cwd IS NOT NULL AND s.cwd != ''
              AND REPLACE(s.cwd, '/', '-') = projects.project_id
            LIMIT 1
         )
       WHERE EXISTS (
         SELECT 1 FROM sessions s
          WHERE s.project_id = projects.project_id
            AND s.cwd IS NOT NULL AND s.cwd != ''
            AND REPLACE(s.cwd, '/', '-') = projects.project_id
       );

      DELETE FROM sessions_fts;
      INSERT INTO sessions_fts(session_id, summary, first_prompt, ai_title, git_branch, original_path)
      SELECT s.session_id,
             COALESCE(s.summary, ''),
             COALESCE(s.first_prompt, ''),
             COALESCE(s.ai_title, ''),
             COALESCE(s.git_branch, ''),
             COALESCE(p.original_path, '')
        FROM sessions s
        LEFT JOIN projects p ON p.project_id = s.project_id;
    `);
  });
}

function runOnce(db: Database.Database, key: string, fn: () => void) {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  if (row) return;
  fn();
  db.prepare("INSERT INTO meta(key,value) VALUES(?,?)").run(key, String(Date.now()));
}

function addColumnIfMissing(db: Database.Database, table: string, column: string, decl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
}

export function setMeta(key: string, value: string) {
  getDb()
    .prepare("INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(key, value);
}

export function getMeta(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}
