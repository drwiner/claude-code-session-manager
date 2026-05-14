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
