import type { ContentBlock } from "./records";

export interface SessionMeta {
  sessionId: string;
  projectId: string;
  filePath: string;
  fileMtime: number;
  fileSize: number;
  isSidechain: boolean;
  parentSessionId: string | null;
  agentId: string | null;
  cwd: string | null;
  gitBranch: string | null;
  model: string | null;
  version: string | null;
  aiTitle: string | null;
  firstPrompt: string | null;
  summary: string | null;
  messageCount: number;
  turnCount: number;
  firstTs: string | null;
  lastTs: string | null;
  /** Timestamp of the most recent user-authored turn (i.e. real prompt). */
  lastUserTs: string | null;
}

export interface TurnRef {
  index: number;
  role: "user" | "assistant";
  ts: string | null;
  summary: string;
  byteStart: number;
  byteEnd: number;
  hasThinking: boolean;
  toolNames: string[];
  /** session_ids of subagents spawned by this turn, if any */
  subagentSessionIds: string[];
}

export interface TurnDetail {
  index: number;
  role: "user" | "assistant";
  ts: string | null;
  blocks: ContentBlock[];
  /** ai-title / permission-mode / plan_mode etc records that occurred inside this turn */
  inlineMarkers: { type: string; subtype?: string; ts?: string; note?: string }[];
}

export interface ProjectRow {
  project_id: string;
  original_path: string;
  dir_path: string;
  last_indexed_at: number | null;
  session_count: number;
}

export interface SessionRow {
  session_id: string;
  project_id: string;
  file_path: string;
  file_mtime: number;
  file_size: number;
  is_sidechain: number;
  parent_session_id: string | null;
  agent_id: string | null;
  cwd: string | null;
  git_branch: string | null;
  model: string | null;
  version: string | null;
  ai_title: string | null;
  first_prompt: string | null;
  summary: string | null;
  message_count: number;
  turn_count: number;
  first_ts: string | null;
  last_ts: string | null;
}
