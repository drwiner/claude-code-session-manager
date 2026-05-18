import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { ACTIVE_SESSIONS_DIR } from "./paths";

export interface ActiveSessionRecord {
  pid: number;
  sessionId: string;
  cwd: string | null;
  status: string | null;
  startedAt: number | null;
  updatedAt: number | null;
  version: string | null;
  tty: string | null;
  itermSessionId: string | null;
}

interface RawActiveSession {
  pid?: number;
  sessionId?: string;
  cwd?: string;
  status?: string;
  startedAt?: number;
  updatedAt?: number;
  version?: string;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

function ttyForPid(pid: number): string | null {
  try {
    const out = execFileSync("ps", ["-p", String(pid), "-o", "tty="], {
      encoding: "utf8",
      timeout: 1000,
    }).trim();
    if (!out || out === "??" || out === "-") return null;
    return out.startsWith("/dev/") ? out : `/dev/${out}`;
  } catch {
    return null;
  }
}

/**
 * Ask iTerm2 (via AppleScript) for every session's id + tty. Returns a map
 * from tty path → iTerm session UUID. Skipped silently if iTerm isn't
 * running or automation permission hasn't been granted yet.
 */
function readItermTtyMap(): Map<string, string> {
  const script = `
    tell application "System Events"
      if not (exists process "iTerm2") then return ""
    end tell
    tell application "iTerm2"
      set out to ""
      repeat with w in windows
        repeat with t in tabs of w
          repeat with s in sessions of t
            set out to out & (id of s) & "\\t" & (tty of s) & linefeed
          end repeat
        end repeat
      end repeat
      return out
    end tell
  `;
  const map = new Map<string, string>();
  try {
    const out = execFileSync("osascript", ["-e", script], {
      encoding: "utf8",
      timeout: 2000,
    });
    for (const line of out.split("\n")) {
      const [id, tty] = line.split("\t");
      if (id && tty) map.set(tty.trim(), id.trim());
    }
  } catch {
    // iTerm not running, automation denied, or timeout — degrade gracefully.
  }
  return map;
}

/**
 * Read `~/.claude/sessions/<pid>.json` files written by every running Claude
 * Code process and return one record per live PID. Stale files (process gone)
 * are skipped — they linger if the CLI exited uncleanly.
 */
export function readActiveSessions(): ActiveSessionRecord[] {
  let names: string[] = [];
  try {
    names = fs.readdirSync(ACTIVE_SESSIONS_DIR);
  } catch {
    return [];
  }
  const live: { raw: RawActiveSession; tty: string | null }[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const fp = path.join(ACTIVE_SESSIONS_DIR, name);
    let raw: RawActiveSession;
    try {
      raw = JSON.parse(fs.readFileSync(fp, "utf8")) as RawActiveSession;
    } catch {
      continue;
    }
    if (typeof raw.pid !== "number" || typeof raw.sessionId !== "string") continue;
    if (!isPidAlive(raw.pid)) continue;
    live.push({ raw, tty: ttyForPid(raw.pid) });
  }

  const itermMap = live.some((x) => x.tty) ? readItermTtyMap() : new Map();

  const out: ActiveSessionRecord[] = live.map(({ raw, tty }) => ({
    pid: raw.pid!,
    sessionId: raw.sessionId!,
    cwd: raw.cwd ?? null,
    status: raw.status ?? null,
    startedAt: raw.startedAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    version: raw.version ?? null,
    tty,
    itermSessionId: tty ? itermMap.get(tty) ?? null : null,
  }));
  out.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return out;
}

/**
 * Focus an iTerm2 session by its UUID and bring iTerm to the front.
 * Returns true on success, false if the session doesn't exist or AppleScript
 * fails (e.g. iTerm closed since we read the map).
 */
export function focusItermSession(itermSessionId: string): boolean {
  if (!/^[A-Fa-f0-9-]{36}$/.test(itermSessionId)) return false;
  const script = `
    tell application "iTerm2"
      repeat with w in windows
        repeat with t in tabs of w
          repeat with s in sessions of t
            if (id of s) is "${itermSessionId}" then
              select s
              select t
              set index of w to 1
              activate
              return "ok"
            end if
          end repeat
        end repeat
      end repeat
      return "not_found"
    end tell
  `;
  try {
    const out = execFileSync("osascript", ["-e", script], {
      encoding: "utf8",
      timeout: 2000,
    }).trim();
    return out === "ok";
  } catch {
    return false;
  }
}
