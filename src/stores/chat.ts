import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import type { AiFriend, BotInfo, ChatMessage, ChatTarget, DialogRow, GroupChat } from "@/api/types";
import type { PlusSocket } from "@/api/socket";
import { useSettingsStore } from "./settings";

type ChatKind = "dialog" | "friend" | "group";

/** Messages + state for one chat surface. */
interface Thread {
  messages: ChatMessage[];
  busy: boolean;
  loaded: boolean;
  updatedAt: number;
  lastMessage?: string;
  /** participantId -> the Webchat session id backing that participant. */
  sessions: Record<string, string>;
}

function emptyThread(): Thread {
  return { messages: [], busy: false, loaded: true, updatedAt: 0, sessions: {} };
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/** How often the bot / dialog / group lists are refreshed from the plugin. */
const POLL_INTERVAL = 60000;

export const useChatStore = defineStore("chat", () => {
  const settings = useSettingsStore();

  /**
   * Bots created in the AstrBot WebUI ("创建机器人" page) — surfaced as 「AI 好友」.
   * Pulled from the server, cached locally.
   */
  const bots = ref<BotInfo[]>(loadJson<BotInfo[]>("astrbot-plus.bots", []));
  /**
   * Webchat conversations — surfaced as 「对话」. One bot ↔ one dialog.
   * Pulled from the server, cached locally.
   */
  const dialogs = ref<DialogRow[]>(loadJson<DialogRow[]>("astrbot-plus.dialogs", []));
  /** Group chats are kept as a local-only feature (reserved, not developed yet). */
  const groups = ref<GroupChat[]>(loadJson<GroupChat[]>("astrbot-plus.groups", []));
  const threads = ref<Record<string, Thread>>(
    loadJson<Record<string, Thread>>("astrbot-plus.threads", {}),
  );
  const unread = ref<Record<string, number>>(loadJson<Record<string, number>>("astrbot-plus.unread", {}));

  watch(bots, (v) => saveJson("astrbot-plus.bots", v), { deep: true });
  watch(dialogs, (v) => saveJson("astrbot-plus.dialogs", v), { deep: true });
  watch(groups, (v) => saveJson("astrbot-plus.groups", v), { deep: true });
  watch(threads, (v) => saveJson("astrbot-plus.threads", v), { deep: true });
  watch(unread, (v) => saveJson("astrbot-plus.unread", v), { deep: true });

  const activeKey = ref("");
  const filter = ref<"all" | "dialog" | "friend" | "group">("all");
  const search = ref("");
  const loadingContacts = ref(false);
  const contactsError = ref("");
  let pollTimer: number | undefined;

  function keyOf(kind: ChatKind, id: string): string {
    return `${kind}:${id}`;
  }

  function ensureThread(key: string): Thread {
    if (!threads.value[key]) threads.value[key] = emptyThread();
    return threads.value[key];
  }

  /** AI friends are the WebUI bots, exposed in the shape the UI expects. */
  const friends = computed<AiFriend[]>(() =>
    bots.value.map((b) => ({
      id: b.id,
      name: b.name || b.id,
      avatarSeed: b.name || b.id,
      createdAt: 0,
    })),
  );

  function botName(botId?: string): string {
    if (!botId) return "";
    return bots.value.find((b) => b.id === botId)?.name || "";
  }

  /** Unified list of dialog + friend(bot) + group rows for the chat list. */
  const contacts = computed<ChatTarget[]>(() => {
    const list: ChatTarget[] = [];

    // 「对话」: Webchat conversations.
    for (const d of dialogs.value) {
      const t = threads.value[keyOf("dialog", d.id)];
      const bot = bots.value.find((b) => b.id === d.botId);
      const name = d.title || bot?.name || "新对话";
      list.push({
        kind: "dialog",
        id: d.id,
        displayName: name,
        avatarSeed: name,
        updatedAt: t?.updatedAt ?? d.updatedAt ?? 0,
        lastMessage: t?.lastMessage,
        messageCount: t?.messages.length ?? 0,
        dialog: d,
        bot,
      });
    }

    // 「AI 好友」: bots created in the AstrBot WebUI.
    for (const b of bots.value) {
      const t = threads.value[keyOf("friend", b.id)];
      list.push({
        kind: "friend",
        id: b.id,
        displayName: b.name || b.id,
        avatarSeed: b.name || b.id,
        updatedAt: t?.updatedAt ?? 0,
        lastMessage: t?.lastMessage,
        messageCount: t?.messages.length ?? 0,
        bot: b,
        friend: friends.value.find((f) => f.id === b.id),
      });
    }

    // 「群聊」: reserved feature.
    for (const g of groups.value) {
      const t = threads.value[keyOf("group", g.id)];
      const members = g.memberIds
        .map((id) => friends.value.find((f) => f.id === id))
        .filter((x): x is AiFriend => !!x);
      list.push({
        kind: "group",
        id: g.id,
        displayName: g.name,
        avatarSeed: g.avatarSeed || g.name,
        updatedAt: t?.updatedAt ?? 0,
        lastMessage: t?.lastMessage,
        messageCount: t?.messages.length ?? 0,
        group: g,
        members,
      });
    }
    return list;
  });

  const filteredContacts = computed(() => {
    const q = search.value.trim().toLowerCase();
    return contacts.value
      .filter((c) => filter.value === "all" || c.kind === filter.value)
      .filter((c) => !q || c.displayName.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  });

  const friendCount = computed(() => bots.value.length);
  const dialogCount = computed(() => dialogs.value.length);
  const groupCount = computed(() => groups.value.length);
  const totalUnread = computed(() => Object.values(unread.value).reduce((s, n) => s + n, 0));

  const activeTarget = computed<ChatTarget | null>(
    () => contacts.value.find((c) => keyOf(c.kind, c.id) === activeKey.value) || null,
  );

  const activeThread = computed<Thread>(() => {
    if (!activeKey.value) return emptyThread();
    return ensureThread(activeKey.value);
  });

  function unreadOf(key: string): number {
    return unread.value[key] ?? 0;
  }

  function markRead(key: string): void {
    if (unread.value[key]) unread.value[key] = 0;
  }

  function markUnread(key: string): void {
    unread.value[key] = Math.max(1, unread.value[key] ?? 0);
  }

  function bumpUnread(key: string): void {
    unread.value[key] = (unread.value[key] ?? 0) + 1;
  }

  function openTarget(t: ChatTarget): void {
    activeKey.value = keyOf(t.kind, t.id);
    markRead(activeKey.value);
  }

  // --- Dialogs (Webchat conversations) -------------------------------------

  async function addDialog(botId?: string): Promise<DialogRow> {
    const dialog = await settings.getSocket().createDialog(botId);
    dialogs.value = [...dialogs.value.filter((d) => d.id !== dialog.id), dialog];
    return dialog;
  }

  /** Return the dialog bound to a bot, creating it on first use (1 bot ↔ 1 dialog). */
  async function ensureBotDialog(bot: BotInfo): Promise<DialogRow> {
    const existing = dialogs.value.find((d) => d.botId === bot.id);
    if (existing) return existing;
    return addDialog(bot.id);
  }

  async function removeDialog(id: string): Promise<void> {
    await settings.getSocket().deleteDialog(id);
    dialogs.value = dialogs.value.filter((d) => d.id !== id);
    delete threads.value[keyOf("dialog", id)];
    delete unread.value[keyOf("dialog", id)];
    if (activeKey.value === keyOf("dialog", id)) activeKey.value = "";
  }

  // --- Groups (reserved feature, local-only) -------------------------------

  async function createGroup(payload: { name: string; memberIds: string[] }): Promise<GroupChat | null> {
    const memberIds = payload.memberIds.filter((id) => bots.value.some((b) => b.id === id));
    if (memberIds.length < 2) return null;
    const group: GroupChat = {
      id: uid("g"),
      name: payload.name.trim() || "群聊",
      memberIds,
      avatarSeed: payload.name.trim() || "群聊",
      createdAt: Date.now(),
    };
    groups.value.push(group);
    return group;
  }

  async function removeGroup(id: string): Promise<void> {
    groups.value = groups.value.filter((g) => g.id !== id);
    delete threads.value[keyOf("group", id)];
    delete unread.value[keyOf("group", id)];
    if (activeKey.value === keyOf("group", id)) activeKey.value = "";
  }

  function memberName(groupId: string, memberId: string): string {
    const g = groups.value.find((x) => x.id === groupId);
    if (!g) return memberId;
    return bots.value.find((b) => b.id === memberId)?.name || memberId;
  }

  // --- Registry sync (companion plugin over Socket.io) ---------------------

  async function loadContacts(): Promise<void> {
    if (!settings.connected) return;
    loadingContacts.value = true;
    contactsError.value = "";
    try {
      const socket = settings.getSocket();
      const [botList, dialogList] = await Promise.all([
        socket.listBots().catch(() => null),
        socket.listDialogs().catch(() => null),
      ]);
      if (Array.isArray(botList)) bots.value = botList;
      if (Array.isArray(dialogList)) dialogs.value = dialogList;
    } catch (e) {
      contactsError.value = errMsg(e);
    } finally {
      loadingContacts.value = false;
    }
  }

  function startPolling(interval = POLL_INTERVAL): void {
    stopPolling();
    pollTimer = window.setInterval(() => {
      void loadContacts();
    }, interval);
  }

  function stopPolling(): void {
    if (pollTimer !== undefined) {
      window.clearInterval(pollTimer);
      pollTimer = undefined;
    }
  }

  function clearThread(key: string): void {
    threads.value[key] = emptyThread();
  }

  // --- Messaging ------------------------------------------------------------

  function pushAssistant(thread: Thread, senderId: string, senderName?: string): number {
    thread.messages.push({
      role: "assistant",
      text: "",
      created_at: new Date().toISOString(),
      streaming: true,
      senderId,
      senderName,
    });
    // Return the index; callers address the bubble through the reactive array so
    // streamed deltas re-render (a raw object reference would bypass Vue's proxy).
    return thread.messages.length - 1;
  }

  function streamChat(
    socket: PlusSocket,
    payload: { sessionId?: string; botId?: string; text: string },
    bubble: ChatMessage,
  ): Promise<string> {
    bubble.streaming = true;
    return new Promise<string>((resolve, reject) => {
      socket.sendChat(payload, {
        onDelta: (_d, full) => {
          bubble.text = full;
        },
        onDone: (full) => {
          if (!bubble.text) bubble.text = full || "(空回复)";
          resolve(bubble.text);
        },
        onError: (err) => reject(err),
      });
    });
  }

  function failBubble(bubble: ChatMessage, e: unknown): void {
    bubble.error = true;
    bubble.text = `发送失败：${errMsg(e)}`;
  }

  async function sendMessage(text: string): Promise<void> {
    const target = activeTarget.value;
    const body = text.trim();
    if (!target || !body) return;
    const key = keyOf(target.kind, target.id);
    const thread = ensureThread(key);
    const now = new Date().toISOString();
    thread.messages.push({ role: "user", text: body, created_at: now });
    thread.updatedAt = Date.now();
    thread.lastMessage = body;

    let socket: PlusSocket;
    try {
      socket = settings.getSocket();
    } catch (e) {
      const idx = pushAssistant(thread, target.id, target.displayName);
      failBubble(thread.messages[idx], e);
      return;
    }

    if (target.kind === "dialog") {
      const dialog = target.dialog!;
      const idx = pushAssistant(thread, dialog.botId || dialog.id, target.displayName);
      thread.busy = true;
      try {
        await streamChat(socket, { sessionId: dialog.id, text: body }, thread.messages[idx]);
      } catch (e) {
        failBubble(thread.messages[idx], e);
      } finally {
        thread.messages[idx].streaming = false;
        thread.busy = false;
        thread.updatedAt = Date.now();
      }
      if (activeKey.value !== key && thread.messages[idx].text && !thread.messages[idx].error) {
        bumpUnread(key);
      }
      return;
    }

    if (target.kind === "friend") {
      const bot = target.bot!;
      const idx = pushAssistant(thread, bot.id, bot.name);
      thread.busy = true;
      try {
        const dialog = await ensureBotDialog(bot);
        await streamChat(socket, { sessionId: dialog.id, botId: bot.id, text: body }, thread.messages[idx]);
      } catch (e) {
        failBubble(thread.messages[idx], e);
      } finally {
        thread.messages[idx].streaming = false;
        thread.busy = false;
        thread.updatedAt = Date.now();
      }
      if (activeKey.value !== key && thread.messages[idx].text && !thread.messages[idx].error) {
        bumpUnread(key);
      }
      return;
    }

    // Group chat: fan out to every member, each with its own dialog/session.
    const group = target.group!;
    const members = group.memberIds
      .map((id) => bots.value.find((b) => b.id === id))
      .filter((x): x is BotInfo => !!x);
    thread.busy = true;
    let replied = 0;
    await Promise.all(
      members.map(async (bot) => {
        const idx = pushAssistant(thread, bot.id, bot.name);
        try {
          const dialog = await ensureBotDialog(bot);
          await streamChat(socket, { sessionId: dialog.id, botId: bot.id, text: body }, thread.messages[idx]);
          replied += 1;
        } catch (e) {
          failBubble(thread.messages[idx], e);
        } finally {
          thread.messages[idx].streaming = false;
        }
      }),
    );
    thread.busy = false;
    thread.updatedAt = Date.now();
    if (activeKey.value !== key && replied > 0) bumpUnread(key);
  }

  return {
    bots,
    dialogs,
    groups,
    friends,
    contacts,
    filteredContacts,
    activeKey,
    activeTarget,
    activeThread,
    filter,
    search,
    unread,
    totalUnread,
    friendCount,
    dialogCount,
    groupCount,
    loadingContacts,
    contactsError,
    addDialog,
    ensureBotDialog,
    removeDialog,
    removeGroup,
    createGroup,
    memberName,
    botName,
    loadContacts,
    startPolling,
    stopPolling,
    openTarget,
    markRead,
    markUnread,
    bumpUnread,
    unreadOf,
    clearThread,
    sendMessage,
  };
});
