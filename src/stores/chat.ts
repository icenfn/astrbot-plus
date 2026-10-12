/**
 * Chat store — Agent conversations.
 *
 * An **Agent** is a bot created in the AstrBot WebUI「创建机器人」page. The
 * directory is pulled from the companion plugin over Socket.io, and each Agent
 * owns a single conversation whose messages stream back over the same socket.
 *
 * The store also consumes the plugin's ``message:new`` broadcast so the list is
 * updated in real time (unread badge / subtitle / system notification) without
 * any manual refresh, and it syncs a session's history from the server whenever
 * a conversation is opened. Conversations are additionally persisted to a local
 * SQLite cache so they survive restarts and remain readable offline.
 */
import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";
import type { AgentRow, ChatMessage, HistoryMessage } from "@/api/types";
import { notify } from "@/composables/useNotify";
import {
  cacheMessages,
  loadCachedMessages,
  cacheSession,
  loadCachedSessions,
} from "@/api/cache";
import { useSettingsStore } from "./settings";

/** Cap a thread's retained messages to keep memory bounded. */
const THREAD_LIMIT = 500;

function tsToIso(ts?: number): string {
  return new Date((ts ?? Date.now() / 1000) * 1000).toISOString();
}

/** Derive the bot id from a `plus_<botId>` session id when no botId is present. */
function botIdFromSession(sessionId?: string): string {
  if (!sessionId) return "";
  return sessionId.startsWith("plus_") ? sessionId.slice("plus_".length) : sessionId;
}

export const useChatStore = defineStore("chat", () => {
  const agents = ref<AgentRow[]>([]);
  const threads = ref<Record<string, ChatMessage[]>>({});
  const sessions = ref<Record<string, string>>({});
  const unread = ref<Record<string, number>>({});
  const activeKey = ref<string>("");
  const loadingContacts = ref(false);
  const contactsError = ref("");
  const sending = ref(false);
  const filter = ref<"agent">("agent");
  const search = ref("");

  let feedBound = false;
  let focusBound = false;
  let feedOff: (() => void) | null = null;

  const filteredAgents = computed(() => {
    const q = search.value.trim().toLowerCase();
    if (!q) return agents.value;
    return agents.value.filter(
      (a) => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q),
    );
  });

  const activeAgent = computed(
    () => agents.value.find((a) => a.id === activeKey.value) ?? null,
  );

  const activeThread = computed(() => {
    const id = activeKey.value;
    const messages = id ? threads.value[id] ?? [] : [];
    return { messages, busy: sending.value };
  });

  const totalUnread = computed(() =>
    Object.values(unread.value).reduce((sum, n) => sum + n, 0),
  );

  function unreadOf(id: string): number {
    return unread.value[id] ?? 0;
  }

  function markRead(id: string): void {
    if (!id) return;
    if ((unread.value[id] ?? 0) === 0) return;
    unread.value = { ...unread.value, [id]: 0 };
  }

  function markUnread(id: string): void {
    if (!id) return;
    unread.value = { ...unread.value, [id]: (unread.value[id] ?? 0) + 1 };
  }

  function ensureThread(id: string): ChatMessage[] {
    if (!threads.value[id]) threads.value[id] = [];
    return threads.value[id];
  }

  function pushMessage(id: string, message: ChatMessage): void {
    const list = ensureThread(id);
    list.push(message);
    if (list.length > THREAD_LIMIT) list.splice(0, list.length - THREAD_LIMIT);
    // Persist to the local SQLite cache (best-effort; no-op off Tauri).
    void cacheMessages(id, list);
  }

  function upsertAgent(raw: {
    id: string;
    name?: string;
    nickname?: string;
    platform?: string;
    enabled?: boolean;
  }): void {
    if (!raw?.id) return;
    // The plugin returns `name` already resolved to the nickname (or the id when
    // no nickname is set), so we display that and keep `id` as the stable key.
    const displayName = raw.name || raw.nickname || raw.id;
    const idx = agents.value.findIndex((a) => a.id === raw.id);
    if (idx >= 0) {
      agents.value[idx] = {
        ...agents.value[idx],
        name: displayName,
        avatarSeed: displayName,
      };
    } else {
      agents.value.push({
        id: raw.id,
        name: displayName,
        avatarSeed: displayName,
        updatedAt: Date.now(),
        messageCount: 0,
      });
    }
  }

  /** True when the app window is focused/visible (drives "background only" notify). */
  function isForeground(): boolean {
    return document.visibilityState === "visible" && document.hasFocus();
  }

  /**
   * Apply an incoming ``message:new`` broadcast: update the list subtitle /
   * ordering, bump the unread badge (unless the conversation is open & focused)
   * and raise a system notification for messages received while backgrounded.
   */
  function receiveMessage(msg: HistoryMessage): void {
    const botId = msg.botId || botIdFromSession(msg.sessionId);
    const id = botId;
    if (!id) return;

    const text = msg.text ?? "";
    if (!text) return;

    // Ensure the agent exists even if the directory hasn't loaded yet.
    upsertAgent({ id, name: id, nickname: "" });

    const row = agents.value.find((a) => a.id === id);
    if (row) {
      row.lastMessage = text;
      row.updatedAt = (msg.ts ?? Date.now() / 1000) * 1000;
      row.messageCount += 1;
    }
    // Re-sort so the most recent conversation floats to the top.
    agents.value = [...agents.value].sort((a, b) => b.updatedAt - a.updatedAt);

    // Mirror bot/assistant messages into the open thread. If a streaming
    // placeholder is still in flight, fill it in place (instead of appending a
    // duplicate) — this is what makes the reply show up immediately without
    // having to leave and re-enter the conversation.
    const isActive = activeKey.value === id;
    if (isActive && msg.role !== "user") {
      const list = ensureThread(id);
      const last = list[list.length - 1];
      if (last && last.role === "assistant" && last.streaming) {
        last.text = text;
        last.streaming = false;
        void cacheMessages(id, list);
      } else if (!(last && last.role === "assistant" && last.text === text)) {
        pushMessage(id, { role: msg.role, text, created_at: tsToIso(msg.ts) });
      }
    }

    const focusedHere = isActive && isForeground();
    if (!focusedHere) {
      markUnread(id);
      const settings = useSettingsStore();
      if (settings.settings.notifyEnabled && msg.role !== "user") {
        void notify({
          title: row?.name || id,
          body: text,
          onlyWhenUnfocused: settings.settings.notifyOnlyBackground,
          onClick: () => {
            activeKey.value = id;
            markRead(id);
          },
        });
      }
    }
  }

  /** Bind the real-time feed once (idempotent). Requires a live socket. */
  function bindFeed(): void {
    const settings = useSettingsStore();
    if (!settings.connected) return;
    if (feedBound) return;
    feedBound = true;
    feedOff = settings.getSocket().on("message:new", (raw) => {
      if (raw && typeof raw === "object") receiveMessage(raw as HistoryMessage);
    });
    // 插件（视图）侧启用/停用/删除机器人后主动广播，客户端据此实时刷新列表。
    settings.getSocket().on("bots:changed", () => { void loadContacts(); });
    if (!focusBound) {
      focusBound = true;
      // 回到客户端窗口 / 标签页恢复可见时同步一次，覆盖后台期间发生的变化。
      window.addEventListener("focus", () => void loadContacts());
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) void loadContacts();
      });
    }
  }

  /** Pull the Agent (bot) directory from the companion plugin. */
  async function loadContacts(): Promise<void> {
    const settings = useSettingsStore();
    if (!settings.connected) return;
    loadingContacts.value = true;
    contactsError.value = "";
    try {
      const bots = await settings.getSocket().listBots();
      for (const bot of bots) upsertAgent(bot);
      bindFeed();
      // 首次同步后补齐每个会话的最近一条消息，使列表副标题在未进入会话前
      // 也能显示最近消息（否则要点击进入才会加载历史）。
      void Promise.all(bots.map((b) => loadHistory(b.id).catch(() => {})));
    } catch (e) {
      contactsError.value = e instanceof Error ? e.message : String(e);
    } finally {
      loadingContacts.value = false;
    }
  }

  /** Restore the agent → session mapping from the local SQLite cache. */
  async function restoreCache(): Promise<void> {
    const cached = await loadCachedSessions();
    if (Object.keys(cached).length) {
      sessions.value = { ...cached, ...sessions.value };
    }
  }

  /** Sync a session's message history from the server + local cache. */
  async function loadHistory(id: string): Promise<void> {
    if (!id) return;
    const settings = useSettingsStore();
    const sessionId = sessions.value[id] || `plus_${id}`;

    let history: HistoryMessage[] = [];
    if (settings.connected) {
      try {
        history = await settings.getSocket().fetchHistory(sessionId, THREAD_LIMIT);
      } catch {
        history = [];
      }
    }

    const local = threads.value[id] ?? [];

    // Nothing from the server and nothing in memory: fall back to the SQLite
    // cache so a previously loaded conversation is still visible offline.
    if (!history.length && !local.length) {
      const cached = await loadCachedMessages(id);
      if (cached.length) threads.value[id] = cached;
      return;
    }

    // Merge with any locally-streamed messages that the server hasn't persisted
    // yet, keyed by role + text to avoid duplicates.
    const seen = new Set(history.map((m) => `${m.role}:${m.text}`));
    const merged: ChatMessage[] = history.map((m) => ({
      role: m.role,
      text: m.text,
      created_at: tsToIso(m.ts),
    }));
    for (const m of local) {
      if (!seen.has(`${m.role}:${m.text}`)) merged.push(m);
    }
    if (merged.length > THREAD_LIMIT) merged.splice(0, merged.length - THREAD_LIMIT);
    threads.value[id] = merged;

    // Keep the list subtitle / ordering in sync with the loaded history so a
    // conversation that already has messages no longer shows "开始对话".
    const row = agents.value.find((a) => a.id === id);
    if (row && merged.length) {
      const last = merged[merged.length - 1];
      row.lastMessage = last.text;
      row.updatedAt = new Date(last.created_at).getTime();
      row.messageCount = merged.length;
    }
    void cacheMessages(id, merged);
  }

  function openAgent(id: string): void {
    activeKey.value = id;
    markRead(id);
    void loadHistory(id);
  }

  function openTarget(agent: AgentRow): void {
    openAgent(agent.id);
  }

  function closeActive(): void {
    activeKey.value = "";
  }

  /** Send a message to the active Agent and stream the reply into its thread. */
  async function sendMessage(text: string): Promise<void> {
    const id = activeKey.value;
    const content = text.trim();
    if (!id || !content || sending.value) return;

    const settings = useSettingsStore();
    pushMessage(id, { role: "user", text: content, created_at: new Date().toISOString() });
    const row = agents.value.find((a) => a.id === id);
    if (row) {
      row.lastMessage = content;
      row.updatedAt = Date.now();
      row.messageCount += 1;
    }
    agents.value = [...agents.value].sort((a, b) => b.updatedAt - a.updatedAt);

    sending.value = true;
    // 必须是响应式对象：下方流式回调会直接改写它，若为普通对象则视图不会刷新，
    // 表现为「发送后要退出再进入消息页才能看到回复」（重新进入会重建线程）。
    const assistant = reactive<ChatMessage>({
      role: "assistant",
      text: "",
      created_at: new Date().toISOString(),
      streaming: true,
    });
    pushMessage(id, assistant);

    try {
      const cleanup = settings.getSocket().sendChat(
        { botId: id, sessionId: sessions.value[id], text: content },
        {
          onSession: (sid) => {
            sessions.value = { ...sessions.value, [id]: sid };
            void cacheSession(id, sid);
          },
          onDelta: (_delta, full) => {
            assistant.text = full;
          },
          onDone: (full) => {
            // Also covers bots with streaming disabled: the server sends the
            // complete text in a single chat:done and no deltas.
            assistant.text = full || assistant.text;
            assistant.streaming = false;
          },
          onError: (err) => {
            assistant.text = err.message;
            assistant.error = true;
            assistant.streaming = false;
          },
        },
      );
      // Resolve when the stream finishes. The watchdog guarantees we never get
      // stuck "busy" forever if the server drops a chat:done (the reply may
      // still have arrived via the message:new feed, which flips `streaming`).
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          window.clearInterval(timer);
          window.clearTimeout(watchdog);
          cleanup();
          resolve();
        };
        const timer = window.setInterval(() => {
          if (!assistant.streaming) finish();
        }, 100);
        const watchdog = window.setTimeout(finish, 120000);
      });
    } catch (e) {
      assistant.text = e instanceof Error ? e.message : String(e);
      assistant.error = true;
      assistant.streaming = false;
    } finally {
      sending.value = false;
      void cacheMessages(id, threads.value[id] ?? []);
    }
  }

  /** Tear down the real-time feed (e.g. on disconnect). */
  function unbindFeed(): void {
    feedOff?.();
    feedOff = null;
    feedBound = false;
  }

  return {
    agents,
    threads,
    sessions,
    unread,
    activeKey,
    loadingContacts,
    contactsError,
    sending,
    filter,
    search,
    filteredAgents,
    activeAgent,
    activeThread,
    totalUnread,
    unreadOf,
    markRead,
    markUnread,
    receiveMessage,
    bindFeed,
    unbindFeed,
    loadContacts,
    restoreCache,
    loadHistory,
    openAgent,
    openTarget,
    closeActive,
    sendMessage,
  };
});
