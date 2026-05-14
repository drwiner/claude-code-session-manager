/**
 * Typed shapes for the records that show up in Claude Code session JSONLs.
 * Records are loosely typed; we keep them as wide objects but expose the
 * fields we actually use during indexing and rendering.
 */

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string; signature?: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: unknown;
      caller?: { type: string };
    }
  | {
      type: "tool_result";
      tool_use_id: string;
      content?: string | Array<{ type: string; text?: string }>;
      is_error?: boolean;
    }
  | { type: "image"; source: unknown }
  | { type: string; [k: string]: unknown };

export interface UserRecord {
  type: "user";
  uuid?: string;
  parentUuid?: string | null;
  sessionId?: string;
  timestamp?: string;
  isSidechain?: boolean;
  isMeta?: boolean;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  message?: {
    role: "user";
    content: string | ContentBlock[];
  };
}

export interface AssistantRecord {
  type: "assistant";
  uuid?: string;
  parentUuid?: string | null;
  sessionId?: string;
  timestamp?: string;
  isSidechain?: boolean;
  requestId?: string;
  message?: {
    id?: string;
    model?: string;
    role: "assistant";
    type?: "message";
    content: ContentBlock[];
    stop_reason?: string;
    usage?: Record<string, number>;
  };
}

export interface AiTitleRecord {
  type: "ai-title";
  aiTitle: string;
  sessionId?: string;
}

export interface PermissionModeRecord {
  type: "permission-mode";
  permissionMode: string;
  sessionId?: string;
  timestamp?: string;
}

export interface SystemRecord {
  type: "system";
  subtype?: string;
  uuid?: string;
  parentUuid?: string | null;
  timestamp?: string;
  durationMs?: number;
  messageCount?: number;
  content?: string;
  isMeta?: boolean;
  slug?: string;
}

export interface GenericRecord {
  type: string;
  uuid?: string;
  parentUuid?: string | null;
  sessionId?: string;
  timestamp?: string;
  isSidechain?: boolean;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  [k: string]: unknown;
}

export type SessionRecord =
  | UserRecord
  | AssistantRecord
  | AiTitleRecord
  | PermissionModeRecord
  | SystemRecord
  | GenericRecord;

export function isUserRecord(r: SessionRecord): r is UserRecord {
  return r.type === "user";
}

export function isAssistantRecord(r: SessionRecord): r is AssistantRecord {
  return r.type === "assistant";
}

/**
 * A "real" user turn vs. a tool_result-carrying user record vs. a meta
 * caveat wrapper. Only "real" user turns should start a new conversation
 * turn in the UI.
 */
export function classifyUserRecord(
  r: UserRecord,
): "prompt" | "tool_result" | "meta" {
  if (r.isMeta) return "meta";
  const content = r.message?.content;
  if (Array.isArray(content)) {
    if (content.length > 0 && content.every((b) => b?.type === "tool_result")) {
      return "tool_result";
    }
    // mixed (text + image) → prompt
    return "prompt";
  }
  if (typeof content === "string") {
    // Strings wrapped in <local-command-caveat> are meta even without isMeta flag
    if (content.startsWith("<local-command-caveat>")) return "meta";
    if (content.startsWith("<command-name>") || content.startsWith("<command-message>"))
      return "meta";
    return "prompt";
  }
  return "meta";
}
