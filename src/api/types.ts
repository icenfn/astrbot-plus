/**
 * AstrBot OpenAPI type definitions (subset used by AstrBot+).
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
}

/** Normalized contact = one conversation row used across the UI. */
export interface Contact {
  /** Stable key: the umo. */
  umo: string;
  /** Server-side user id used by the conversation detail endpoint (usually == umo). */
  userId: string;
  cid: string;
  displayName: string;
  platform: string;
  messageType: string;
  username: string;
  avatarSeed: string;
  updatedAt: number;
  /** Latest message text, used as the chat-list subtitle. */
  lastMessage?: string;
  /** Number of real messages in the conversation (drives unread counting). */
  messageCount?: number;
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
