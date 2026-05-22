import { getDb } from "./db";
import type { SessionSource, TurnRef } from "./types";

/**
 * Sentinel chars wrapping the matched term inside FTS5 snippet output.
 * The UI escapes the snippet HTML and then swaps these for <mark>…</mark>,
 * which keeps the rendering XSS-safe even though session bodies can
 * contain anything.
 */
export const SEARCH_HIGHLIGHT_START = "";
export const SEARCH_HIGHLIGHT_END = "";

export interface SessionListRow {
  session_id: string;
  project_id: string;
  original_path: string | null;
  cwd: string | null;
  source: SessionSource;
  ai_title: string | null;
  first_prompt: string | null;
  summary: string | null;
  git_branch: string | null;
  model: string | null;
  message_count: number;
  turn_count: number;
  first_ts: string | null;
  last_ts: string | null;
  last_user_ts: string | null;
  is_sidechain: number;
  parent_session_id: string | null;
  origin_host: string | null;
  repo_snapshots: string | null;
  /** When the row came back from a search, an excerpt with highlight sentinels. */
  match_snippet?: string | null;
  /** Index of the user turn that matched, if the hit came from turns_fts. */
  match_turn_index?: number | null;
}

export interface ListSessionsOpts {
  search?: string;
  projectId?: string;
  includeSidechain?: boolean;
  limit?: number;
  offset?: number;
}

export function listSessions(opts: ListSessionsOpts = {}): SessionListRow[] {
  const db = getDb();
  const params: Record<string, unknown> = {
    limit: opts.limit ?? 200,
    offset: opts.offset ?? 0,
  };
  const wheres: string[] = [];
  if (!opts.includeSidechain) wheres.push("s.is_sidechain = 0");
  if (opts.projectId) {
    wheres.push("s.project_id = @projectId");
    params.projectId = opts.projectId;
  }

  // Sort by last user input timestamp (the moment the human last typed something),
  // falling back to last_ts when a session has no user turn timestamp recorded.
  const orderBy = "ORDER BY COALESCE(s.last_user_ts, s.last_ts) DESC";

  let sql: string;
  if (opts.search && opts.search.trim().length > 0) {
    params.q = ftsQuery(opts.search.trim());
    // Two FTS sources: sessions_fts (titles/first_prompt/branch/path) and
    // turns_fts (per-user-prompt body). Union them, then pick one "best"
    // match row per session: a turn-body hit wins over a metadata hit, and
    // we take the earliest matching turn so the snippet anchors near the
    // start of the conversation. snippet() is computed only for turn hits
    // — metadata hits fall back to the title rendered by the existing row UI.
    sql = `
      WITH all_matches AS (
        SELECT session_id,
               NULL AS match_turn_index,
               NULL AS match_snippet,
               0 AS prio
          FROM sessions_fts
         WHERE sessions_fts MATCH @q
        UNION ALL
        SELECT session_id,
               turn_index AS match_turn_index,
               snippet(turns_fts, 2, char(1), char(2), '…', 12) AS match_snippet,
               1 AS prio
          FROM turns_fts
         WHERE turns_fts MATCH @q
      ),
      best_match AS (
        SELECT session_id, match_turn_index, match_snippet,
               ROW_NUMBER() OVER (
                 PARTITION BY session_id
                 ORDER BY prio DESC, match_turn_index ASC
               ) AS rn
          FROM all_matches
      )
      SELECT s.session_id, s.project_id, p.original_path, s.cwd, s.source, s.ai_title,
             s.first_prompt, s.summary, s.git_branch, s.model,
             s.message_count, s.turn_count, s.first_ts, s.last_ts, s.last_user_ts,
             s.is_sidechain, s.parent_session_id, s.origin_host, s.repo_snapshots,
             m.match_turn_index, m.match_snippet
        FROM best_match m
        JOIN sessions s ON s.session_id = m.session_id
        LEFT JOIN projects p ON p.project_id = s.project_id
       WHERE m.rn = 1
       ${wheres.length ? "AND " + wheres.join(" AND ") : ""}
       ${orderBy}
       LIMIT @limit OFFSET @offset
    `;
  } else {
    sql = `
      SELECT s.session_id, s.project_id, p.original_path, s.cwd, s.source, s.ai_title,
             s.first_prompt, s.summary, s.git_branch, s.model,
             s.message_count, s.turn_count, s.first_ts, s.last_ts, s.last_user_ts,
             s.is_sidechain, s.parent_session_id, s.origin_host, s.repo_snapshots
        FROM sessions s
        LEFT JOIN projects p ON p.project_id = s.project_id
       ${wheres.length ? "WHERE " + wheres.join(" AND ") : ""}
       ${orderBy}
       LIMIT @limit OFFSET @offset
    `;
  }
  return db.prepare(sql).all(params) as SessionListRow[];
}

function ftsQuery(raw: string): string {
  // Escape FTS5 syntax characters by quoting individual tokens.
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => `"${tok.replaceAll('"', '""')}"*`)
    .join(" ");
}

export interface SessionFull extends SessionListRow {
  file_path: string;
  file_mtime: number;
  file_size: number;
  version: string | null;
}

export function getSession(sessionId: string): SessionFull | null {
  const row = getDb()
    .prepare(
      `SELECT s.session_id, s.project_id, p.original_path, s.cwd, s.source, s.ai_title,
              s.first_prompt, s.summary, s.git_branch, s.model,
              s.message_count, s.turn_count, s.first_ts, s.last_ts, s.last_user_ts,
              s.is_sidechain, s.parent_session_id, s.origin_host, s.repo_snapshots,
              s.file_path, s.file_mtime, s.file_size, s.version
         FROM sessions s
         LEFT JOIN projects p ON p.project_id = s.project_id
        WHERE s.session_id = ?`,
    )
    .get(sessionId) as SessionFull | undefined;
  return row ?? null;
}

export interface TurnRow {
  turn_index: number;
  role: "user" | "assistant";
  ts: string | null;
  byte_start: number;
  byte_end: number;
  summary: string | null;
  has_thinking: number;
  tool_names: string | null;
  subagent_session_ids: string | null;
}

export function listTurns(sessionId: string): TurnRow[] {
  return getDb()
    .prepare(
      `SELECT turn_index, role, ts, byte_start, byte_end, summary, has_thinking, tool_names, subagent_session_ids
         FROM turns
        WHERE session_id = ?
        ORDER BY turn_index ASC`,
    )
    .all(sessionId) as TurnRow[];
}

export function getTurnRef(sessionId: string, turnIndex: number): TurnRef | null {
  const row = getDb()
    .prepare(
      `SELECT turn_index, role, ts, byte_start, byte_end, summary, has_thinking, tool_names, subagent_session_ids
         FROM turns WHERE session_id = ? AND turn_index = ?`,
    )
    .get(sessionId, turnIndex) as TurnRow | undefined;
  if (!row) return null;
  return {
    index: row.turn_index,
    role: row.role,
    ts: row.ts,
    summary: row.summary ?? "",
    byteStart: row.byte_start,
    byteEnd: row.byte_end,
    hasThinking: row.has_thinking === 1,
    toolNames: row.tool_names ? (JSON.parse(row.tool_names) as string[]) : [],
    subagentSessionIds: row.subagent_session_ids
      ? (JSON.parse(row.subagent_session_ids) as string[])
      : [],
  };
}

export function listSubagentsFor(parentSessionId: string): SessionListRow[] {
  return getDb()
    .prepare(
      `SELECT s.session_id, s.project_id, p.original_path, s.cwd, s.source, s.ai_title,
              s.first_prompt, s.summary, s.git_branch, s.model,
              s.message_count, s.turn_count, s.first_ts, s.last_ts, s.last_user_ts,
              s.is_sidechain, s.parent_session_id
         FROM sessions s
         LEFT JOIN projects p ON p.project_id = s.project_id
        WHERE s.parent_session_id = ?
        ORDER BY s.first_ts ASC`,
    )
    .all(parentSessionId) as SessionListRow[];
}

export interface ProjectListRow {
  project_id: string;
  original_path: string;
  session_count: number;
  subagent_count: number;
}

export function listProjects(): ProjectListRow[] {
  return getDb()
    .prepare(
      `SELECT p.project_id, p.original_path,
              COALESCE(SUM(CASE WHEN s.is_sidechain = 0 THEN 1 ELSE 0 END), 0) AS session_count,
              COALESCE(SUM(CASE WHEN s.is_sidechain = 1 THEN 1 ELSE 0 END), 0) AS subagent_count
         FROM projects p
         LEFT JOIN sessions s ON s.project_id = p.project_id
        GROUP BY p.project_id
        ORDER BY p.original_path ASC`,
    )
    .all() as ProjectListRow[];
}

/**
 * Substring match against project path or project_id (case-insensitive).
 * Used to surface projects in the search results when a user types a path-y
 * fragment like "datacenter-data".
 */
export function searchProjects(query: string, limit = 20): ProjectListRow[] {
  const q = query.trim();
  if (!q) return [];
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return getDb()
    .prepare(
      `SELECT p.project_id, p.original_path,
              COALESCE(SUM(CASE WHEN s.is_sidechain = 0 THEN 1 ELSE 0 END), 0) AS session_count,
              COALESCE(SUM(CASE WHEN s.is_sidechain = 1 THEN 1 ELSE 0 END), 0) AS subagent_count
         FROM projects p
         LEFT JOIN sessions s ON s.project_id = p.project_id
        WHERE p.original_path LIKE @like ESCAPE '\\'
           OR p.project_id LIKE @like ESCAPE '\\'
        GROUP BY p.project_id
        ORDER BY p.original_path ASC
        LIMIT @limit`,
    )
    .all({ like, limit }) as ProjectListRow[];
}

export function getSessionsByIds(sessionIds: string[]): SessionListRow[] {
  if (sessionIds.length === 0) return [];
  const placeholders = sessionIds.map(() => "?").join(",");
  return getDb()
    .prepare(
      `SELECT s.session_id, s.project_id, p.original_path, s.cwd, s.source, s.ai_title,
              s.first_prompt, s.summary, s.git_branch, s.model,
              s.message_count, s.turn_count, s.first_ts, s.last_ts, s.last_user_ts,
              s.is_sidechain, s.parent_session_id
         FROM sessions s
         LEFT JOIN projects p ON p.project_id = s.project_id
        WHERE s.session_id IN (${placeholders})`,
    )
    .all(...sessionIds) as SessionListRow[];
}

export function totalSessionCount(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM sessions WHERE is_sidechain = 0")
    .get() as { n: number };
  return row.n;
}
