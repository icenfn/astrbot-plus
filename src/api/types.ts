/**
 * AstrBot OpenAPI + AstrBot+ type definitions.
 * Reference: https://docs.astrbot.app/dev/openapi.html
 */

export interface UmoInfo {
  umo: string;
  platform: string;
  message_type: string; // FriendMessage | GroupMessage | ...
  session_id: string;
  auto_name?: string;
  user_alias?: string;
  display_name: string;
  creator_sender_id?: string;
}

export interface Conversation {
  platform_id: string;
  user_id: string;
  cid: string;
  title: string | null;
  persona_id: string | null;
  token_usage: number;
  created_at: number;
  updated_at: number;
  umo_info: UmoInfo;
  /** JSON-encoded history array (string) or an already-parsed array. */
  history?: string | HistoryEntry[];
}

export interface SessionInfo {
  umo: string;
  platform: string;
  message_type: string;
  session_id: string;
  auto_name: string;
  user_alias: string;
  display_name: string;
  creator_sender_id: string;
  custom_name?: string;
  session_enabled?: boolean;
  llm_enabled?: boolean;
  tts_enabled?: boolean;
  has_rules?: boolean;
}

/** A single content part inside a message. */
export interface MessagePart {
  type: string; // plain | text | image | file | ...
  text?: string;
  attachment_id?: string;
}

export interface HistoryEntry {
  role: string; // user | assistant | _checkpoint
  content: MessagePart[] | Record<string, unknown> | string;
}

export interface ChatMessage {
  id?: number | string;
  run_id?: string;
  role: "user" | "assistant" | "system";
  text: string;
  created_at: string;
  streaming?: boolean;
  error?: boolean;
  /** Token usage reported for the assistant turn, when available. */
  tokens?: { input?: number; output?: number };
  /** For group chats: which AI participant produced / receives this turn. */
  senderId?: string;
  senderName?: string;
}

/** A server conversation row (kept for the OpenAPI client helpers). */
export interface Contact {
  umo: string;
  userId: string;
  cid: string;
  displayName: string;
  platform: string;
  messageType: string;
  username: string;
  avatarSeed: string;
  updatedAt: number;
  lastMessage?: string;
  messageCount?: number;
}

/**
 * The two chat surfaces of AstrBot+:
 *  - `friend`: a 1:1 private chat with a single AI friend.
 *  - `group`:  a group chat hosting several AI friends at once.
 */
export type ChatKind = "friend" | "group";

/**
 * A user-defined AI friend. Each friend maps to one AstrBot chat
 * configuration (provider / persona) and owns an independent chat context.
 */
export interface AiFriend {
  id: string;
  name: string;
  /** Optional AstrBot chat config (provider) id used for this friend. */
  configId?: string;
  /** Optional AstrBot persona id. */
  personaId?: string;
  avatarSeed: string;
  createdAt: number;
}

/** A group chat hosting two or more AI friends. */
export interface GroupChat {
  id: string;
  name: string;
  /** Member AI friend ids. Each member keeps its own session context. */
  memberIds: string[];
  avatarSeed: string;
  createdAt: number;
}

/** A unified row shown in the chat list (friend or group). */
export interface ChatTarget {
  kind: ChatKind;
  id: string;
  displayName: string;
  avatarSeed: string;
  updatedAt: number;
  lastMessage?: string;
  messageCount: number;
  friend?: AiFriend;
  group?: GroupChat;
  members?: AiFriend[];
}

export interface ProviderInfo {
  id: string;
  model?: string;
  provider: string;
  enable?: boolean;
  provider_type?: string;
}

export interface ApiEnvelope<T> {
  status: "ok" | "error";
  message: string | null;
  data: T;
}
