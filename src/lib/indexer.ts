import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { getDb, setMeta } from "./db";
import { decodeProjectFolderHeuristic } from "./decode-path";
import { indexSession } from "./parse-session";
import { PROJECTS_DIR } from "./paths";
import type { SessionMeta, TurnRef } from "./types";

interface SessionsIndexEntry {
  sessionId: string;
  fullPath: string;
  fileMtime: number;
  firstPrompt: string;
  summary: string;
  messageCount: number;
  created: string;
  modified: string;
  gitBranch: string;
  projectPath: string;
  isSidechain: boolean;
}

interface SessionsIndexFile {
  version: number;
  originalPath: string;
  entries: SessionsIndexEntry[];
}

interface IndexerStats {
  projectsScanned: number;
  sessionsChanged: number;
  sessionsSkipped: number;
  errors: { file: string; message: string }[];
  durationMs: number;
}

let indexerInFlight: Promise<IndexerStats> | null = null;

export function getRunningIndexer(): Promise<IndexerStats> | null {
  return indexerInFlight;
}

export function runIndexer(): Promise<IndexerStats> {
  if (indexerInFlight) return indexerInFlight;
  indexerInFlight = (async () => {
    try {
      return await runIndexerImpl();
    } finally {
      indexerInFlight = null;
    }
  })();
  return indexerInFlight;
}

async function runIndexerImpl(): Promise<IndexerStats> {
  const t0 = Date.now();
  const stats: IndexerStats = {
    projectsScanned: 0,
    sessionsChanged: 0,
    sessionsSkipped: 0,
    errors: [],
    durationMs: 0,
  };

  if (!fs.existsSync(PROJECTS_DIR)) {
    console.warn(`[indexer] ${PROJECTS_DIR} not found — nothing to index`);
    stats.durationMs = Date.now() - t0;
    return stats;
  }

  const db = getDb();
  const projectEntries = await fsp.readdir(PROJECTS_DIR, { withFileTypes: true });

  for (const ent of projectEntries) {
    if (!ent.isDirectory()) continue;
    const projectId = ent.name;
    const projectDir = path.join(PROJECTS_DIR, projectId);
    stats.projectsScanned += 1;

    // Try to read sessions-index.json for the authoritative originalPath
    let originalPath = decodeProjectFolderHeuristic(projectId);
    let indexEntries: Map<string, SessionsIndexEntry> = new Map();
    try {
      const idxPath = path.join(projectDir, "sessions-index.json");
      const raw = await fsp.readFile(idxPath, "utf8");
      const parsed = JSON.parse(raw) as SessionsIndexFile;
      if (parsed.originalPath) originalPath = parsed.originalPath;
      for (const e of parsed.entries ?? []) indexEntries.set(e.sessionId, e);
    } catch {
      // no sessions-index.json — fine
    }

    db.prepare(
      `INSERT INTO projects(project_id, original_path, dir_path, last_indexed_at)
       VALUES(?,?,?,?)
       ON CONFLICT(project_id) DO UPDATE SET original_path=excluded.original_path, dir_path=excluded.dir_path, last_indexed_at=excluded.last_indexed_at`,
    ).run(projectId, originalPath, projectDir, Date.now());

    // 1. Top-level session JSONLs
    const files = await fsp.readdir(projectDir, { withFileTypes: true });
    for (const f of files) {
      if (!f.isFile()) continue;
      if (!f.name.endsWith(".jsonl")) continue;
      const fp = path.join(projectDir, f.name);
      const sessionId = f.name.replace(/\.jsonl$/, "");
      const seed = indexEntries.get(sessionId);
      try {
        const changed = await indexOneSession({
          projectId,
          sessionId,
          filePath: fp,
          parentSessionId: null,
          agentId: null,
          seed,
        });
        if (changed) stats.sessionsChanged += 1;
        else stats.sessionsSkipped += 1;
      } catch (err) {
        stats.errors.push({ file: fp, message: (err as Error).message });
      }
    }

    // 2. Subagent JSONLs under <projectDir>/<sessionId>/subagents/agent-*.jsonl
    for (const f of files) {
      if (!f.isDirectory()) continue;
      // Only UUID-named dirs are session folders
      if (!/^[0-9a-f-]{36}$/i.test(f.name)) continue;
      const parentSessionId = f.name;
      const subagentDir = path.join(projectDir, parentSessionId, "subagents");
      if (!fs.existsSync(subagentDir)) continue;
      let subFiles: fs.Dirent[] = [];
      try {
        subFiles = await fsp.readdir(subagentDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const sf of subFiles) {
        if (!sf.isFile() || !sf.name.endsWith(".jsonl")) continue;
        const fp = path.join(subagentDir, sf.name);
        const agentId = sf.name.replace(/^agent-/, "").replace(/\.jsonl$/, "");
        const sessionId = `${parentSessionId}::${agentId}`;
        try {
          const changed = await indexOneSession({
            projectId,
            sessionId,
            filePath: fp,
            parentSessionId,
            agentId,
            seed: undefined,
          });
          if (changed) stats.sessionsChanged += 1;
          else stats.sessionsSkipped += 1;
        } catch (err) {
          stats.errors.push({ file: fp, message: (err as Error).message });
        }
      }
    }
  }

  setMeta("last_indexed_at", String(Date.now()));
  stats.durationMs = Date.now() - t0;
  console.log(
    `[indexer] scanned ${stats.projectsScanned} projects · ${stats.sessionsChanged} changed · ${stats.sessionsSkipped} skipped · ${stats.errors.length} errors · ${stats.durationMs}ms`,
  );
  if (stats.errors.length > 0) {
    for (const e of stats.errors.slice(0, 5)) console.warn(`[indexer] error in ${e.file}: ${e.message}`);
  }
  return stats;
}

interface IndexOneArgs {
  projectId: string;
  sessionId: string;
  filePath: string;
  parentSessionId: string | null;
  agentId: string | null;
  seed: SessionsIndexEntry | undefined;
}

async function indexOneSession(args: IndexOneArgs): Promise<boolean> {
  const stat = await fsp.stat(args.filePath);
  const fileMtime = stat.mtimeMs;
  const fileSize = stat.size;

  const db = getDb();
  const existing = db
    .prepare("SELECT file_mtime, file_size FROM sessions WHERE session_id = ?")
    .get(args.sessionId) as { file_mtime: number; file_size: number } | undefined;

  if (existing && existing.file_mtime === fileMtime && existing.file_size === fileSize) {
    return false;
  }

  const { meta, turns } = await indexSession(args.filePath);

  const fullMeta: SessionMeta = {
    sessionId: args.sessionId,
    projectId: args.projectId,
    filePath: args.filePath,
    fileMtime,
    fileSize,
    isSidechain: args.parentSessionId !== null || meta.isSidechain,
    parentSessionId: args.parentSessionId,
    agentId: args.agentId,
    cwd: meta.cwd ?? null,
    gitBranch: meta.gitBranch ?? args.seed?.gitBranch ?? null,
    model: meta.model ?? null,
    version: meta.version ?? null,
    aiTitle: meta.aiTitle ?? args.seed?.summary ?? null,
    firstPrompt: meta.firstPrompt ?? args.seed?.firstPrompt ?? null,
    summary: meta.aiTitle ?? args.seed?.summary ?? meta.firstPrompt ?? null,
    messageCount: meta.messageCount || (args.seed?.messageCount ?? 0),
    turnCount: meta.turnCount,
    firstTs: meta.firstTs ?? args.seed?.created ?? null,
    lastTs: meta.lastTs ?? args.seed?.modified ?? null,
  };

  upsertSession(fullMeta, turns);
  return true;
}

function upsertSession(meta: SessionMeta, turns: TurnRef[]) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO sessions (
         session_id, project_id, file_path, file_mtime, file_size,
         is_sidechain, parent_session_id, agent_id,
         cwd, git_branch, model, version,
         ai_title, first_prompt, summary,
         message_count, turn_count, first_ts, last_ts
       ) VALUES (
         @session_id, @project_id, @file_path, @file_mtime, @file_size,
         @is_sidechain, @parent_session_id, @agent_id,
         @cwd, @git_branch, @model, @version,
         @ai_title, @first_prompt, @summary,
         @message_count, @turn_count, @first_ts, @last_ts
       )
       ON CONFLICT(session_id) DO UPDATE SET
         project_id=excluded.project_id,
         file_path=excluded.file_path,
         file_mtime=excluded.file_mtime,
         file_size=excluded.file_size,
         is_sidechain=excluded.is_sidechain,
         parent_session_id=excluded.parent_session_id,
         agent_id=excluded.agent_id,
         cwd=excluded.cwd,
         git_branch=excluded.git_branch,
         model=excluded.model,
         version=excluded.version,
         ai_title=excluded.ai_title,
         first_prompt=excluded.first_prompt,
         summary=excluded.summary,
         message_count=excluded.message_count,
         turn_count=excluded.turn_count,
         first_ts=excluded.first_ts,
         last_ts=excluded.last_ts`,
    ).run({
      session_id: meta.sessionId,
      project_id: meta.projectId,
      file_path: meta.filePath,
      file_mtime: Math.floor(meta.fileMtime),
      file_size: meta.fileSize,
      is_sidechain: meta.isSidechain ? 1 : 0,
      parent_session_id: meta.parentSessionId,
      agent_id: meta.agentId,
      cwd: meta.cwd,
      git_branch: meta.gitBranch,
      model: meta.model,
      version: meta.version,
      ai_title: meta.aiTitle,
      first_prompt: meta.firstPrompt,
      summary: meta.summary,
      message_count: meta.messageCount,
      turn_count: meta.turnCount,
      first_ts: meta.firstTs,
      last_ts: meta.lastTs,
    });

    db.prepare("DELETE FROM turns WHERE session_id = ?").run(meta.sessionId);
    const insertTurn = db.prepare(
      `INSERT INTO turns(session_id, turn_index, role, ts, byte_start, byte_end, summary, has_thinking, tool_names, subagent_session_ids)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
    );
    for (const t of turns) {
      insertTurn.run(
        meta.sessionId,
        t.index,
        t.role,
        t.ts,
        t.byteStart,
        t.byteEnd,
        t.summary,
        t.hasThinking ? 1 : 0,
        JSON.stringify(t.toolNames),
        JSON.stringify(t.subagentSessionIds),
      );
    }

    // FTS: delete + re-insert (no virtual UPSERT)
    db.prepare("DELETE FROM sessions_fts WHERE session_id = ?").run(meta.sessionId);
    const projectRow = db
      .prepare("SELECT original_path FROM projects WHERE project_id = ?")
      .get(meta.projectId) as { original_path: string } | undefined;
    db.prepare(
      `INSERT INTO sessions_fts(session_id, summary, first_prompt, ai_title, git_branch, original_path)
       VALUES(?,?,?,?,?,?)`,
    ).run(
      meta.sessionId,
      meta.summary ?? "",
      meta.firstPrompt ?? "",
      meta.aiTitle ?? "",
      meta.gitBranch ?? "",
      projectRow?.original_path ?? "",
    );
  });
  tx();
}
