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

export const useChatStore = defineStore("chat", () => {
  const settings = useSettingsStore();

  const contacts = ref<Contact[]>([]);
  const activeUmo = ref<string>("");
  const threads = ref<Record<string, Thread>>({});
  const loadingContacts = ref(false);
  const contactsError = ref("");
  const filter = ref<"all" | "FriendMessage" | "GroupMessage">("all");
  const search = ref("");

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

  async function loadContacts() {
    if (!settings.hasCredentials) return;
    loadingContacts.value = true;
    contactsError.value = "";
    try {
      const client = settings.buildClient();
      const rows = await client.listConversations({ page: 1, pageSize: 200 });
      contacts.value = rows.map(toContact);
    } catch (e) {
      contactsError.value = e instanceof Error ? e.message : String(e);
    } finally {
      loadingContacts.value = false;
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
      const history = parseHistory(conv);
      threads.value[contact.umo].messages = history;
    } catch {
      // History may be unavailable; keep the empty thread.
    }
  }

  async function openContact(contact: Contact) {
    activeUmo.value = contact.umo;
    await ensureThreadLoaded(contact);
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
      if (record) record.updatedAt = Date.now() / 1000;
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
    friendCount,
    groupCount,
    loadContacts,
    openContact,
    sendMessage,
    clearThread,
  };
});
