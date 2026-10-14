/**
 * AstrBot+ type definitions.
 *
 * AstrBot+ only exposes one chat surface: an **Agent**, i.e. a bot created in
 * the AstrBot WebUI「创建机器人」page. Its directory is pulled from the
 * companion plugin over Socket.io.
 */

/** A message record pushed by the plugin (`message:new`) or read via `chat:history`. */
export interface HistoryMessage {
  sessionId?: string;
  botId?: string;
  role: "user" | "assistant" | "system";
  text: string;
  /** Unix timestamp (seconds). */
  ts?: number;
}

/** An Agent row rendered in the chat list. One Agent == one AstrBot bot. */
export interface AgentRow {
  id: string;
  name: string;
  avatarSeed: string;
  updatedAt: number;
  lastMessage?: string;
  messageCount: number;
}

export type ChatRole = "user" | "assistant" | "system";

/** A single message inside an Agent thread. */
export interface ChatMessage {
  role: ChatRole;
  text: string;
  created_at: string;
  /** Set on an assistant bubble that failed (rendered with an error style). */
  error?: boolean;
}
