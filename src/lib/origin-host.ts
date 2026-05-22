import fs from "fs";
import os from "os";

export const LOCAL_HOST = os.hostname();

interface OriginSidecar {
  hostname: string;
  claimedAt: number;
}

function sidecarPath(jsonlPath: string): string {
  return `${jsonlPath}.host.json`;
}

/**
 * Files whose birthtime is more than this many ms newer than their mtime
 * look like Syncthing imports rather than locally-authored files: the
 * filesystem stamped "created" when the file landed here, but Syncthing
 * preserved the original mtime from the source machine. We refuse to
 * claim those for the local host so the originating machine's indexer
 * can claim them the next time it runs.
 */
const IMPORT_BIRTHTIME_SLACK_MS = 10 * 60 * 1000;

/**
 * Look up the originating host for a session JSONL. The first machine to
 * index a session writes a `<file>.host.json` sidecar claiming it for its
 * hostname; Syncthing then distributes the sidecar alongside the JSONL so
 * every other machine reads the same answer.
 *
 * When no sidecar exists, we use the birthtime-vs-mtime heuristic to
 * decide whether claiming for the local host is safe: Syncthing preserves
 * mtime from the source but creates the file fresh on the receiving side,
 * leaving a wide birthtime/mtime gap on imports. Files that look local
 * (birthtime ≈ mtime) get claimed; suspected imports are left unclaimed.
 *
 * Returns the resolved hostname, or null when no sidecar exists and the
 * file looks imported (or we couldn't write the claim).
 */
export function resolveOriginHost(jsonlPath: string): string | null {
  const sp = sidecarPath(jsonlPath);
  try {
    const raw = fs.readFileSync(sp, "utf8");
    const parsed = JSON.parse(raw) as Partial<OriginSidecar>;
    if (typeof parsed.hostname === "string" && parsed.hostname.length > 0) {
      return parsed.hostname;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      // Corrupt or unreadable sidecar — fall through and try to rewrite.
    }
  }

  let looksLocal = true;
  try {
    const stat = fs.statSync(jsonlPath);
    if (stat.birthtimeMs - stat.mtimeMs > IMPORT_BIRTHTIME_SLACK_MS) {
      looksLocal = false;
    }
  } catch {
    return null;
  }
  if (!looksLocal) return null;

  const payload: OriginSidecar = { hostname: LOCAL_HOST, claimedAt: Date.now() };
  try {
    fs.writeFileSync(sp, JSON.stringify(payload), { flag: "wx" });
    return LOCAL_HOST;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      try {
        const raw = fs.readFileSync(sp, "utf8");
        const parsed = JSON.parse(raw) as Partial<OriginSidecar>;
        if (typeof parsed.hostname === "string" && parsed.hostname.length > 0) {
          return parsed.hostname;
        }
      } catch {
        return null;
      }
    }
    return null;
  }
}
