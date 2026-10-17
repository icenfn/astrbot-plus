/**
 * Local message cache backed by SQLite (Tauri SQL plugin).
 *
 * Conversations are persisted locally so they survive an app restart and stay
 * readable offline; when the plugin is unavailable (for example `npm run dev`
 * in a plain browser) every call is a best-effort no-op, so the rest of the app
 * keeps working unchanged.
 */
import { isTauri } from "./env";
import type { ChatMessage } from "./types";
import type Database from "@tauri-apps/plugin-sql";

const DB_URL = "sqlite:astrbot-plus.db";

let dbPromise: Promise<Database | null> | null = null;

async function open(): Promise<Database | null> {
  if (!isTauri()) return null;
  try {
    const { default: SqlDatabase } = await import("@tauri-apps/plugin-sql");
    const db = await SqlDatabase.load(DB_URL);
    await db.execute(
      `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
    );
    await db.execute(
      `CREATE TABLE IF NOT EXISTS sessions (
        agent_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL
      )`,
    );
    await db.execute(
      `CREATE TABLE IF NOT EXISTS pins (
        agent_id TEXT PRIMARY KEY,
        pinned INTEGER NOT NULL DEFAULT 0
      )`,
    );
    return db;
  } catch (e) {
    console.warn("[cache] sqlite unavailable:", e);
    return null;
  }
}

function getDb(): Promise<Database | null> {
  if (!dbPromise) dbPromise = open();
  return dbPromise;
}

/** Replace an Agent's cached messages with the given list. */
export async function cacheMessages(agentId: string, messages: ChatMessage[]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute("DELETE FROM messages WHERE agent_id = $1", [agentId]);
    for (const m of messages.slice(-500)) {
      await db.execute(
        "INSERT INTO messages (agent_id, role, text, created_at) VALUES ($1, $2, $3, $4)",
        [agentId, m.role, m.text, m.created_at],
      );
    }
  } catch (e) {
    console.warn("[cache] write failed:", e);
  }
}

/** Load an Agent's cached messages (oldest first). */
export async function loadCachedMessages(agentId: string): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db.select<{ role: string; text: string; created_at: string }[]>(
      "SELECT role, text, created_at FROM messages WHERE agent_id = $1 ORDER BY id ASC",
      [agentId],
    );
    return rows.map((r) => ({
      role: r.role as ChatMessage["role"],
      text: r.text,
      created_at: r.created_at,
    }));
  } catch (e) {
    console.warn("[cache] read failed:", e);
    return [];
  }
}

/** Persist the agent → session id mapping. */
export async function cacheSession(agentId: string, sessionId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(
      "INSERT INTO sessions (agent_id, session_id) VALUES ($1, $2) ON CONFLICT(agent_id) DO UPDATE SET session_id = $2",
      [agentId, sessionId],
    );
  } catch (e) {
    console.warn("[cache] session write failed:", e);
  }
}

/** Delete one conversation's cached messages + its session mapping. */
export async function deleteCachedConversation(agentId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute("DELETE FROM messages WHERE agent_id = $1", [agentId]);
    await db.execute("DELETE FROM sessions WHERE agent_id = $1", [agentId]);
    await db.execute("DELETE FROM pins WHERE agent_id = $1", [agentId]);
  } catch (e) {
    console.warn("[cache] delete failed:", e);
  }
}

/** Persist the pinned-conversation flags (local-only UI state). */
export async function cachePinned(pinned: Record<string, boolean>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute("DELETE FROM pins");
    for (const [agentId, on] of Object.entries(pinned)) {
      if (!on) continue;
      await db.execute(
        "INSERT INTO pins (agent_id, pinned) VALUES ($1, 1)",
        [agentId],
      );
    }
  } catch (e) {
    console.warn("[cache] pin write failed:", e);
  }
}

/** Load the pinned-conversation flags. */
export async function loadCachedPinned(): Promise<Record<string, boolean>> {
  const db = await getDb();
  if (!db) return {};
  try {
    const rows = await db.select<{ agent_id: string }[]>("SELECT agent_id FROM pins");
    const out: Record<string, boolean> = {};
    for (const r of rows) out[r.agent_id] = true;
    return out;
  } catch {
    return {};
  }
}

export async function loadCachedSessions(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  try {
    const rows = await db.select<{ agent_id: string; session_id: string }[]>(
      "SELECT agent_id, session_id FROM sessions",
    );
    const out: Record<string, string> = {};
    for (const r of rows) out[r.agent_id] = r.session_id;
    return out;
  } catch {
    return {};
  }
}
