import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { parseHistory, toContact } from "@/api/client";
import type { ChatMessage, Contact } from "@/api/types";
import { AstrbotWsClient, type WsMessageFrame, type WsStatus } from "@/api/ws";
import { useSettingsStore } from "./settings";

interface Thread {
  /** Running-last messages for this conversation, keyed by umo. */
  messages: ChatMessage[];
  /** Whether the thread is currently waiting for a reply. */
  busy: boolean;
  loaded: boolean;
}

function emptyThread(): Thread {
  return { messages: [], busy: false, loaded: false };
}

/** How often the conversation list is refreshed while the app is idle. */
const POLL_INTERVAL = 25000;
/** Only conversations of the AstrBot+ platform are shown. */
const PLATFORM = "astrbot-plus";

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
  const wsStatus = ref<WsStatus>("idle");

  let pollTimer: number | undefined;
  let ws: AstrbotWsClient | null = null;

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

  // ------------------------------------------------------------------ #
  // Conversation list (HTTP) — used to enumerate AstrBot+ conversations
  // ------------------------------------------------------------------ #

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
        platforms: PLATFORM,
      });
      // Defensive: the API filter may not be honoured by every AstrBot build,
      // so only keep AstrBot+ conversations on the client as well.
      const next = rows.map(toContact).filter((c) => (c.platform || "") === PLATFORM);
      const detect = opts.detectNew ?? initialized.value;
      for (const c of next) {
        const count = c.messageCount ?? 0;
        const prev = seenCounts.value[c.umo];
        if (detect && prev !== undefined && count > prev && c.umo !== activeUmo.value) {
          unread.value[c.umo] = (unread.value[c.umo] ?? 0) + (count - prev);
        }
        seenCounts.value[c.umo] = count;
      }
      // Keep locally-created (not yet persisted) chats that the server has not
      // returned yet, so a brand-new conversation does not vanish.
      const localOnly = contacts.value.filter(
        (c) => !c.cid && !next.some((n) => n.umo === c.umo),
      );
      contacts.value = [...next, ...localOnly];
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

  // ------------------------------------------------------------------ #
  // WebSocket transport
  // ------------------------------------------------------------------ #

  function composedWsUrl(): string {
    const url = settings.settings.wsUrl.trim();
    if (!url) return "";
    const token = settings.settings.wsToken.trim();
    if (!token) return url;
    return `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
  }

  /** Open the WebSocket connection (keyboard-free chat transport). */
  function connectWs() {
    const url = composedWsUrl();
    if (!url) {
      wsStatus.value = "idle";
      return;
    }
    disconnectWs();
    ws = new AstrbotWsClient({
      url,
      onStatus: (s) => {
        wsStatus.value = s;
      },
      onMessage: (frame) => handleFrame(frame),
    });
    ws.connect();
  }

  function disconnectWs() {
    if (ws) {
      ws.close();
      ws = null;
    }
    wsStatus.value = "idle";
  }

  /** Handle an inbound frame from the plugin. */
  function handleFrame(frame: WsMessageFrame) {
    const type = String(frame.type || "");
    if (type === "message") {
      const umo = String(frame.umo || "");
      if (!umo) return;
      const text = String(frame.text ?? "");
      const role: ChatMessage["role"] = frame.role === "user" ? "user" : "assistant";

      const thread = threads.value[umo] || (threads.value[umo] = emptyThread());
      thread.loaded = true;
      const last = thread.messages[thread.messages.length - 1];
      if (last && last.streaming && last.role === "assistant") {
        last.text = text;
        last.streaming = false;
      } else {
        thread.messages.push({ role, text, created_at: new Date().toISOString() });
      }
      thread.busy = false;

      const record = contacts.value.find((c) => c.umo === umo);
      if (record) {
        record.updatedAt = Date.now() / 1000;
        record.lastMessage = text;
        record.messageCount = (record.messageCount ?? 0) + 1;
        seenCounts.value[umo] = record.messageCount;
      } else {
        // A conversation we do not know about yet — refresh the list.
        void loadContacts({ detectNew: true });
      }
      if (umo !== activeUmo.value) {
        unread.value[umo] = (unread.value[umo] ?? 0) + 1;
      }
      return;
    }
    if (type === "ready") {
      wsStatus.value = "open";
    }
  }

  // ------------------------------------------------------------------ #
  // Threads
  // ------------------------------------------------------------------ #

  async function ensureThreadLoaded(contact: Contact) {
    const t = threads.value[contact.umo];
    if (t?.loaded) return;
    // Mark as loaded up-front so a slow/failed fetch is not retried in a loop.
    threads.value[contact.umo] = { messages: [], busy: false, loaded: true };
    if (!contact.cid) return; // brand-new chat: no server history yet
    try {
      const client = settings.buildClient();
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

  /** Delete a conversation on the server (when persisted) and locally. */
  async function deleteContact(contact: Contact) {
    if (contact.cid) {
      const client = settings.buildClient();
      await client.deleteConversation(contact.cid, contact.userId || contact.umo);
    }
    contacts.value = contacts.value.filter((c) => c.umo !== contact.umo);
    delete threads.value[contact.umo];
    delete unread.value[contact.umo];
    delete seenCounts.value[contact.umo];
    if (activeUmo.value === contact.umo) activeUmo.value = "";
  }

  /**
   * Create (or open) a single- or group-chat conversation.
   * The UMO follows AstrBot's `{platform}:{message_type}:{session_id}` scheme.
   */
  function createChat(input: {
    name: string;
    type: "FriendMessage" | "GroupMessage";
    id?: string;
  }): Contact | null {
    const sessionId = (input.id || input.name || "").trim();
    if (!sessionId) return null;
    const umo = `${PLATFORM}:${input.type}:${sessionId}`;
    let contact = contacts.value.find((c) => c.umo === umo);
    if (!contact) {
      contact = {
        umo,
        userId: umo,
        cid: "",
        displayName: (input.name || sessionId).trim(),
        platform: PLATFORM,
        messageType: input.type,
        username: "astrbot_plus",
        avatarSeed: input.name || sessionId,
        updatedAt: Date.now() / 1000,
        lastMessage: "",
        messageCount: 0,
      };
      contacts.value.push(contact);
    }
    void openContact(contact);
    return contact;
  }

  /**
   * Send a text message over the WebSocket and append it to the thread.
   * The assistant reply arrives asynchronously via a `message` frame.
   */
  function sendMessage(text: string, contact: Contact): void {
    const body = text.trim();
    if (!body || !contact) return;
    const thread = threads.value[contact.umo] || (threads.value[contact.umo] = emptyThread());
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

    if (!ws || wsStatus.value !== "open") connectWs();
    ws?.send({
      type: "send",
      umo: contact.umo,
      text: body,
      name: contact.displayName,
      client_id: `${Date.now()}`,
    });

    const record = contacts.value.find((c) => c.umo === contact.umo);
    if (record) {
      record.updatedAt = Date.now() / 1000;
      record.lastMessage = body;
      record.messageCount = (record.messageCount ?? 0) + 1;
      seenCounts.value[contact.umo] = record.messageCount;
    }

    // Safety net: clear the spinner if the adapter never answers.
    window.setTimeout(() => {
      if (!assistant.streaming) return;
      assistant.streaming = false;
      thread.busy = false;
      const idx = thread.messages.indexOf(assistant);
      if (idx >= 0 && !assistant.text) thread.messages.splice(idx, 1);
    }, 90000);
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
    wsStatus,
    loadContacts,
    startPolling,
    stopPolling,
    connectWs,
    disconnectWs,
    openContact,
    markRead,
    markUnread,
    deleteContact,
    createChat,
    sendMessage,
    clearThread,
    unreadOf,
  };
});
