/**
 * AstrBot+ type definitions.
 *
 * AstrBot+ only exposes one chat surface: an **Agent**, i.e. a bot created in
 * the AstrBot WebUI「创建机器人」page. Its directory is pulled from the
 * companion plugin over Socket.io.
 */

/** A bot created in the AstrBot WebUI（「创建机器人」page）, surfaced as an Agent. */
export interface BotInfo {
  id: string;
  name: string;
  platform?: string;
  enabled?: boolean;
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
  id?: number | string;
  run_id?: string;
  role: ChatRole;
  text: string;
  created_at: string;
  streaming?: boolean;
  error?: boolean;
  /** Token usage reported for the assistant turn, when available. */
  tokens?: { input?: number; output?: number };
}
