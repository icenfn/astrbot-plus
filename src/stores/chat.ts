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
 * a conversation is opened.
 */
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { AgentRow, ChatMessage, HistoryMessage } from "@/api/types";
import { notify } from "@/composables/useNotify";
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

    // Append to the open thread if this is the active conversation and the
    // message didn't originate from our own optimistic UI (role user messages
    // are already echoed locally, so only mirror bot/assistant messages here).
    const isActive = activeKey.value === id;
    if (isActive && msg.role !== "user") {
      const list = ensureThread(id);
      const last = list[list.length - 1];
      // Skip if the streaming reply already rendered this exact text.
      if (!(last && last.role === "assistant" && last.text === text)) {
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
    } catch (e) {
      contactsError.value = e instanceof Error ? e.message : String(e);
    } finally {
      loadingContacts.value = false;
    }
  }

  /** Sync a session's message history from the server (client history sync). */
  async function loadHistory(id: string): Promise<void> {
    const settings = useSettingsStore();
    if (!settings.connected || !id) return;
    const sessionId = sessions.value[id] || `plus_${id}`;
    try {
      const history = await settings
        .getSocket()
        .fetchHistory(sessionId, THREAD_LIMIT);
      if (!history.length) return;
      // Merge with any locally-streamed messages that the server hasn't
      // persisted yet, keyed by role + text to avoid duplicates.
      const local = threads.value[id] ?? [];
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
    } catch {
      /* history sync is best-effort */
    }
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
    const assistant: ChatMessage = {
      role: "assistant",
      text: "",
      created_at: new Date().toISOString(),
      streaming: true,
    };
    pushMessage(id, assistant);

    try {
      const cleanup = settings.getSocket().sendChat(
        { botId: id, sessionId: sessions.value[id], text: content },
        {
          onSession: (sid) => {
            sessions.value = { ...sessions.value, [id]: sid };
          },
          onDelta: (_delta, full) => {
            assistant.text = full;
          },
          onDone: (full) => {
            // Also covers bots with streaming disabled: the server sends the
            // complete text in a single chat:done and no deltas.
            assistant.text = full;
            assistant.streaming = false;
          },
          onError: (err) => {
            assistant.text = err.message;
            assistant.error = true;
            assistant.streaming = false;
          },
        },
      );
      await new Promise<void>((resolve) => {
        const timer = window.setInterval(() => {
          if (!assistant.streaming) {
            window.clearInterval(timer);
            cleanup();
            resolve();
          }
        }, 100);
      });
    } catch (e) {
      assistant.text = e instanceof Error ? e.message : String(e);
      assistant.error = true;
      assistant.streaming = false;
    } finally {
      sending.value = false;
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
    loadHistory,
    openAgent,
    openTarget,
    closeActive,
    sendMessage,
  };
});
