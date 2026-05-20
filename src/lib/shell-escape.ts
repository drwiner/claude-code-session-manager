/**
 * Wrap a string in single quotes safely for POSIX shells.
 * Single quotes inside the value are closed, escaped, and reopened.
 */
export function shellSingleQuote(value: string): string {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

export function buildResumeCommand(cwd: string | null | undefined, sessionId: string): string {
  if (cwd && cwd.length > 0) {
    return `cd ${shellSingleQuote(cwd)} && claude --resume ${sessionId}`;
  }
  return `claude --resume ${sessionId}`;
}

export function buildCodexResumeCommand(cwd: string | null | undefined, sessionId: string): string {
  if (cwd && cwd.length > 0) {
    return `cd ${shellSingleQuote(cwd)} && codex resume ${sessionId}`;
  }
  return `codex resume ${sessionId}`;
}
