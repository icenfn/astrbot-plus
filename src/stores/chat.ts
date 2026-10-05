import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { parseHistory, toContact } from "@/api/client";
import type { ChatMessage, Contact } from "@/api/types";
import { useSettingsStore } from "./settings";

interface Thread {
  /** Running-last messages for this conversation, keyed by umo. */
  messages: ChatMessage[];
  /** Server session id used to keep context across turns (from chat SSE). */
  sessionId?: string;
  /** Whether the thread is currently streaming a reply. */
  busy: boolean;
  loaded: boolean;
}

function emptyThread(): Thread {
  return { messages: [], busy: false, loaded: false };
}

/** How often the conversation list is refreshed while the app is idle. */
const POLL_INTERVAL = 15000;

export const useChatStore = defineStore("chat", () => {
  const settings = useSettingsStore();

  const contacts = ref<Contact[]>([]);
  const activeUmo = ref<string>("");
  const threads = ref<Record<string, Thread>>({});
  const loadingContacts = ref(false);
  const contactsError = ref("");
  const filter = ref<"all" | "FriendMessage" | "GroupMessage">("all");
  const search = ref("");

  /** Unread count per umo (Telegram-style red badge). */
  const unread = ref<Record<string, number>>({});
  /** Last observed message count per umo, used to detect new messages. */
  const seenCounts = ref<Record<string, number>>({});
  const initialized = ref(false);
  let pollTimer: number | undefined;

  const activeContact = computed(
    () => contacts.value.find((c) => c.umo === activeUmo.value) || null,
  );

  const activeThread = computed<Thread>(() => {
    if (!activeUmo.value) return emptyThread();
    if (!threads.value[activeUmo.value]) threads.value[activeUmo.value] = emptyThread();
    return threads.value[activeUmo.value];
  });

  const filteredContacts = computed(() => {
    const q = search.value.trim().toLowerCase();
    return contacts.value
      .filter((c) => filter.value === "all" || c.messageType === filter.value)
      .filter((c) => !q || c.displayName.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  });

  const friendCount = computed(
    () => contacts.value.filter((c) => c.messageType === "FriendMessage").length,
  );
  const groupCount = computed(
    () => contacts.value.filter((c) => c.messageType === "GroupMessage").length,
  );
  const totalUnread = computed(() =>
    Object.values(unread.value).reduce((sum, n) => sum + n, 0),
  );

  function unreadOf(umo: string): number {
    return unread.value[umo] ?? 0;
  }

  /**
   * Load the conversation list.
   * When `detectNew` is true (polling / later refreshes) any increase in a
   * conversation's message count is recorded as unread — except for the
   * conversation currently open.
   */
  async function loadContacts(opts: { detectNew?: boolean } = {}) {
    if (!settings.hasCredentials) return;
    loadingContacts.value = true;
    contactsError.value = "";
    try {
      const client = settings.buildClient();
      const rows = await client.listConversations({
        page: 1,
        pageSize: 200,
        includeHistory: true,
      });
      const next = rows.map(toContact);
      const detect = opts.detectNew ?? initialized.value;
      for (const c of next) {
        const count = c.messageCount ?? 0;
        const prev = seenCounts.value[c.umo];
        if (detect && prev !== undefined && count > prev && c.umo !== activeUmo.value) {
          unread.value[c.umo] = (unread.value[c.umo] ?? 0) + (count - prev);
        }
        seenCounts.value[c.umo] = count;
      }
      contacts.value = next;
      initialized.value = true;
    } catch (e) {
      contactsError.value = e instanceof Error ? e.message : String(e);
    } finally {
      loadingContacts.value = false;
    }
  }

  function startPolling(interval = POLL_INTERVAL) {
    stopPolling();
    pollTimer = window.setInterval(() => {
      void loadContacts({ detectNew: true });
    }, interval);
  }

  function stopPolling() {
    if (pollTimer !== undefined) {
      window.clearInterval(pollTimer);
      pollTimer = undefined;
    }
  }

  async function ensureThreadLoaded(contact: Contact) {
    const t = threads.value[contact.umo];
    if (t?.loaded) return;
    // Mark as loaded up-front so a slow/failed fetch is not retried in a loop.
    threads.value[contact.umo] = { messages: [], busy: false, loaded: true };
    try {
      const client = settings.buildClient();
      // The conversation detail endpoint needs the row's own user_id (the umo),
      // not the display / sender name.
      const conv = await client.getConversation(contact.cid, contact.userId || contact.umo);
      threads.value[contact.umo].messages = parseHistory(conv);
    } catch {
      // History may be unavailable; keep the empty thread.
    }
  }

  async function openContact(contact: Contact) {
    activeUmo.value = contact.umo;
    markRead(contact.umo);
    await ensureThreadLoaded(contact);
  }

  function markRead(umo: string) {
    if (unread.value[umo]) unread.value[umo] = 0;
  }

  /** Manually flag a conversation as unread (Telegram-style). */
  function markUnread(umo: string) {
    unread.value[umo] = Math.max(1, unread.value[umo] ?? 0);
  }

  /** Delete a conversation on the server and locally. */
  async function deleteContact(contact: Contact) {
    const client = settings.buildClient();
    await client.deleteConversation(contact.cid, contact.userId || contact.umo);
    contacts.value = contacts.value.filter((c) => c.umo !== contact.umo);
    delete threads.value[contact.umo];
    delete unread.value[contact.umo];
    delete seenCounts.value[contact.umo];
    if (activeUmo.value === contact.umo) activeUmo.value = "";
  }

  /**
   * Send a plain-text message in the active conversation and stream the reply.
   * A new conversation (no cid yet) is created server-side via username.
   */
  async function sendMessage(text: string, contact: Contact): Promise<void> {
    const body = text.trim();
    if (!body || !contact) return;
    const thread =
      threads.value[contact.umo] || (threads.value[contact.umo] = emptyThread());
    thread.loaded = true;

    const now = new Date().toISOString();
    thread.messages.push({ role: "user", text: body, created_at: now });
    const assistant: ChatMessage = {
      role: "assistant",
      text: "",
      created_at: now,
      streaming: true,
    };
    thread.messages.push(assistant);
    thread.busy = true;

    try {
      const client = settings.buildClient();
      await client.chatStream(
        {
          username: contact.username || "astrbot_plus",
          message: body,
          sessionId: thread.sessionId,
          conversationId: contact.cid || undefined,
        },
        {
          onSessionId: (sid) => {
            thread.sessionId = sid;
          },
          onDelta: (_d, full) => {
            assistant.text = full;
          },
          onTokens: (tk) => {
            assistant.tokens = tk;
          },
        },
      );
      if (!assistant.text) assistant.text = "(空回复)";
    } catch (e) {
      assistant.error = true;
      assistant.text = `发送失败：${e instanceof Error ? e.message : String(e)}`;
    } finally {
      assistant.streaming = false;
      thread.busy = false;
      const record = contacts.value.find((c) => c.umo === contact.umo);
      if (record) {
        record.updatedAt = Date.now() / 1000;
        record.lastMessage = assistant.text;
        record.messageCount = (record.messageCount ?? 0) + 2;
        // Keep the baseline in sync so polling does not double-count our own turn.
        seenCounts.value[contact.umo] = record.messageCount;
      }
    }
  }

  function clearThread(umo: string) {
    threads.value[umo] = emptyThread();
  }

  return {
    contacts,
    activeUmo,
    threads,
    activeContact,
    activeThread,
    filteredContacts,
    loadingContacts,
    contactsError,
    filter,
    search,
    unread,
    totalUnread,
    friendCount,
    groupCount,
    loadContacts,
    startPolling,
    stopPolling,
    openContact,
    markRead,
    markUnread,
    deleteContact,
    sendMessage,
    clearThread,
    unreadOf,
  };
});
