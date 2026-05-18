import os from "os";
import path from "path";

export const HOME = os.homedir();
export const CLAUDE_DIR = path.join(HOME, ".claude");
export const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");
export const ACTIVE_SESSIONS_DIR = path.join(CLAUDE_DIR, "sessions");
export const DB_PATH = path.join(process.cwd(), "data", "index.db");
