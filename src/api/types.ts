/**
 * AstrBot+ type definitions.
 *
 * Two peer kinds live in one IM surface:
 *
 *   • Agent — a bot created in the AstrBot WebUI「创建机器人」page; its directory
 *     is fetched from the HTTP API (`GET /api/agents`) and streamed over
 *     Socket.io (`chat:send` / `chat:delta` / `chat:done`).
 *   • User  — another end user of the same backend; directory from
 *     `GET /api/users`, one-to-one messages over `private:send` /
 *     `private:message`.
 */

export type PeerType = "agent" | "user";

/** A user row from `GET /api/users` (the friend directory, self excluded). */
export interface UserRow {
  id: string;
  username: string;
  email?: string;
  /** Stable avatar fingerprint / hash. */
  df?: string;
}

/** An Agent row from `GET /api/agents`. */
export interface AgentRow {
  id: string;
  name: string;
  /** 机器人指纹（128 位 hash），由服务端生成，用于长期识别同一机器人。 */
  botdf?: string;
  enabled?: boolean;
  // ---- local-only UI state (filled by the chat store) --------------------
  avatarSeed?: string;
  updatedAt?: number;
  lastMessage?: string;
  messageCount?: number;
}

/** A single message inside a thread (rendered by MessageBubble). */
export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  text: string;
  created_at: string;
  /** Set on an assistant bubble that failed (rendered with an error style). */
  error?: boolean;
  /** Local-only: id of the server message (when known) for dedupe. */
  serverId?: string | number;
  /** Local-only: pending outgoing reqId (optimistic send). */
  pendingReqId?: string;
}

/**
 * A history message row returned by `GET /api/messages`, and also the shape of
 * the `private:message` / `message:new` push events.
 */
export interface HistoryMessage {
  id?: string | number;
  peerType?: PeerType;
  peerId?: string;
  fromUserId?: string;
  fromUsername?: string;
  toUserId?: string;
  reqId?: string;
  role: ChatRole;
  text: string;
  /** Unix timestamp (seconds). */
  ts?: number;
  // legacy fields kept for backward compatibility with the old plugin protocol
  sessionId?: string;
  botId?: string;
}

/** Payload of `private:message` (server → client). */
export interface PrivateMessage {
  id: string | number;
  reqId?: string;
  fromUserId: string;
  fromUsername?: string;
  toUserId?: string;
  text: string;
  ts: number;
}
