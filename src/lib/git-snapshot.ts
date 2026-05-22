import { execFileSync } from "child_process";
import fs from "fs";

export interface RepoSnapshot {
  cwd: string;
  branch: string | null;
  head: string;
  dirty: boolean;
  capturedAt: number;
}

function sidecarPath(jsonlPath: string): string {
  return `${jsonlPath}.git.json`;
}

function git(cwd: string, args: string[], timeoutMs = 1500): string | null {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      timeout: timeoutMs,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Read HEAD + branch + dirty flag for the repo at `cwd`. Returns null if
 * the path isn't a repo, isn't reachable on this machine, or git times
 * out. Cheap on a warm checkout — three rev-parse / status calls.
 */
export function captureRepoSnapshot(cwd: string): RepoSnapshot | null {
  if (!cwd) return null;
  try {
    if (!fs.existsSync(cwd)) return null;
  } catch {
    return null;
  }
  const head = git(cwd, ["rev-parse", "HEAD"]);
  if (!head) return null;
  const branchRaw = git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const branch = branchRaw && branchRaw !== "HEAD" ? branchRaw : null;
  const status = git(cwd, ["status", "--porcelain"]);
  const dirty = status !== null && status.length > 0;
  return { cwd, branch, head, dirty, capturedAt: Date.now() };
}

/**
 * Read the cached snapshots sidecar for a session JSONL, if it exists.
 * Returns an empty array on miss or parse error.
 */
export function readRepoSnapshotsSidecar(jsonlPath: string): RepoSnapshot[] {
  try {
    const raw = fs.readFileSync(sidecarPath(jsonlPath), "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as RepoSnapshot[];
  } catch {
    // missing or unreadable
  }
  return [];
}

function writeRepoSnapshotsSidecar(jsonlPath: string, snapshots: RepoSnapshot[]): void {
  try {
    fs.writeFileSync(sidecarPath(jsonlPath), JSON.stringify(snapshots));
  } catch {
    // best-effort; don't block indexing on sidecar write failures
  }
}

/**
 * Merge a freshly-captured snapshot into the sidecar's per-cwd map: keep
 * the most recent snapshot per cwd, replacing any existing entry. Writes
 * the sidecar back so Syncthing distributes it to other machines. Returns
 * the full updated list (one entry per cwd ever seen for this session).
 */
export function resolveRepoSnapshots(
  jsonlPath: string,
  cwd: string | null,
): RepoSnapshot[] {
  const existing = readRepoSnapshotsSidecar(jsonlPath);
  if (!cwd) return existing;
  const fresh = captureRepoSnapshot(cwd);
  if (!fresh) return existing;
  const byCwd = new Map<string, RepoSnapshot>();
  for (const s of existing) byCwd.set(s.cwd, s);
  byCwd.set(fresh.cwd, fresh);
  const merged = Array.from(byCwd.values());
  writeRepoSnapshotsSidecar(jsonlPath, merged);
  return merged;
}
