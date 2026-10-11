/**
 * Chat store — Agent conversations.
 *
 * An **Agent** is a bot created in the AstrBot WebUI「创建机器人」page. The
 * directory is pulled from the companion plugin over Socket.io, and each Agent
 * owns a single conversation whose messages stream back over the same socket.
 */
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { AgentRow, ChatMessage } from "@/api/types";
import { useSettingsStore } from "./settings";

/** Cap a thread's retained messages to keep memory bounded. */
const THREAD_LIMIT = 500;

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

  let pollTimer: number | undefined;

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

  function upsertAgent(raw: { id: string; name?: string; platform?: string; enabled?: boolean }): void {
    if (!raw?.id) return;
    const idx = agents.value.findIndex((a) => a.id === raw.id);
    if (idx >= 0) {
      agents.value[idx] = { ...agents.value[idx], name: raw.name || agents.value[idx].name };
    } else {
      agents.value.push({
        id: raw.id,
        name: raw.name || raw.id,
        avatarSeed: raw.name || raw.id,
        updatedAt: Date.now(),
        messageCount: 0,
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
    } catch (e) {
      contactsError.value = e instanceof Error ? e.message : String(e);
    } finally {
      loadingContacts.value = false;
    }
  }

  function openAgent(id: string): void {
    activeKey.value = id;
    markRead(id);
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

  function startPolling(intervalMs: number): void {
    stopPolling();
    pollTimer = window.setInterval(() => void loadContacts(), Math.max(5000, intervalMs));
  }

  function stopPolling(): void {
    if (pollTimer !== undefined) {
      window.clearInterval(pollTimer);
      pollTimer = undefined;
    }
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
    loadContacts,
    openAgent,
    openTarget,
    closeActive,
    sendMessage,
    startPolling,
    stopPolling,
  };
});
