import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import type { AiFriend, ChatMessage, ChatTarget, GroupChat } from "@/api/types";
import { useSettingsStore } from "./settings";

type ChatKind = "friend" | "group";

/** Messages + per-participant session state for one chat surface. */
interface Thread {
  messages: ChatMessage[];
  busy: boolean;
  loaded: boolean;
  updatedAt: number;
  lastMessage?: string;
  /** participantId -> AstrBot session id (independent context per AI). */
  sessions: Record<string, string>;
  /** participantId -> AstrBot conversation id. */
  conversations: Record<string, string>;
}

function emptyThread(): Thread {
  return { messages: [], busy: false, loaded: true, updatedAt: 0, sessions: {}, conversations: {} };
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * AstrBot's `waking_check` stage strips a single leading wake-prefix (default
 * "/") from every inbound message before it reaches the pipeline / LLM. A user
 * who literally types "/xxx" would therefore have the leading slash swallowed
 * and the AI only ever sees "xxx". Doubling the leading slash escapes it: the
 * server removes exactly one and the model receives the original "/xxx".
 */
function escapeLeadingSlash(text: string): string {
  return text.startsWith("/") ? `/${text}` : text;
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

/**
 * WebChat UMO scheme used by AstrBot+.
 *
 *  - private (friend) chat : `webchat:FriendMessage:<friendId>`
 *  - group chat member     : `webchat:GroupMessage:<groupId>:<friendId>`
 *
 * Every group member gets its own UMO (and its own session id), so the AI
 * participants in a group never share a session context.
 */
export function friendUmo(friendId: string): string {
  return `webchat:FriendMessage:${friendId}`;
}

export function groupMemberUmo(groupId: string, friendId: string): string {
  return `webchat:GroupMessage:${groupId}:${friendId}`;
}

/** How often the friend/group registry is refreshed from the companion plugin. */
const POLL_INTERVAL = 60000;

export const useChatStore = defineStore("chat", () => {
  const settings = useSettingsStore();

  const friends = ref<AiFriend[]>(loadJson<AiFriend[]>("astrbot-plus.friends", []));
  const groups = ref<GroupChat[]>(loadJson<GroupChat[]>("astrbot-plus.groups", []));
  const threads = ref<Record<string, Thread>>(
    loadJson<Record<string, Thread>>("astrbot-plus.threads", {}),
  );
  const unread = ref<Record<string, number>>(loadJson<Record<string, number>>("astrbot-plus.unread", {}));

  watch(friends, (v) => saveJson("astrbot-plus.friends", v), { deep: true });
  watch(groups, (v) => saveJson("astrbot-plus.groups", v), { deep: true });
  watch(threads, (v) => saveJson("astrbot-plus.threads", v), { deep: true });
  watch(unread, (v) => saveJson("astrbot-plus.unread", v), { deep: true });

  const activeKey = ref("");
  const filter = ref<"all" | "friend" | "group">("all");
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

  /** Unified list of friend + group rows for the chat list. */
  const contacts = computed<ChatTarget[]>(() => {
    const list: ChatTarget[] = [];
    for (const f of friends.value) {
      const t = threads.value[keyOf("friend", f.id)];
      list.push({
        kind: "friend",
        id: f.id,
        displayName: f.name,
        avatarSeed: f.avatarSeed || f.name,
        updatedAt: t?.updatedAt ?? 0,
        lastMessage: t?.lastMessage,
        messageCount: t?.messages.length ?? 0,
        friend: f,
      });
    }
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

  const friendCount = computed(() => friends.value.length);
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

  /** Increment the unread counter (a genuinely new incoming message). */
  function bumpUnread(key: string): void {
    unread.value[key] = (unread.value[key] ?? 0) + 1;
  }

  function openTarget(t: ChatTarget): void {
    activeKey.value = keyOf(t.kind, t.id);
    markRead(activeKey.value);
  }

  // --- AI friends -----------------------------------------------------------

  async function addFriend(payload: {
    name: string;
    configId?: string;
    personaId?: string;
  }): Promise<AiFriend> {
    const friend: AiFriend = {
      id: uid("f"),
      name: payload.name.trim() || "AI 好友",
      configId: payload.configId?.trim() || undefined,
      personaId: payload.personaId?.trim() || undefined,
      avatarSeed: payload.name.trim() || "AI",
      createdAt: Date.now(),
    };
    friends.value.push(friend);
    // Best-effort: mirror the friend to the companion plugin when reachable.
    try {
      const client = settings.buildClient();
      await client.plusCreateUser({
        id: friend.id,
        name: friend.name,
        configId: friend.configId,
        personaId: friend.personaId,
      });
    } catch {
      /* offline / plugin missing – local copy is authoritative */
    }
    return friend;
  }

  async function removeFriend(id: string): Promise<void> {
    friends.value = friends.value.filter((f) => f.id !== id);
    // Drop the friend from any group it belonged to.
    for (const g of groups.value) g.memberIds = g.memberIds.filter((m) => m !== id);
    delete threads.value[keyOf("friend", id)];
    delete unread.value[keyOf("friend", id)];
    if (activeKey.value === keyOf("friend", id)) activeKey.value = "";
    const client = settings.buildClient();
    // Delete the matching server-side AstrBot conversation so the local and the
    // server histories stay in sync (otherwise the messages linger on the server
    // and later resurface, which was the "删除不同步" bug).
    try {
      await client.deleteConversationsByUmo([friendUmo(id)]);
    } catch {
      /* best-effort */
    }
    try {
      await client.plusDeleteUser(id);
    } catch {
      /* best-effort */
    }
  }

  // --- Group chats ----------------------------------------------------------

  async function createGroup(payload: { name: string; memberIds: string[] }): Promise<GroupChat | null> {
    const memberIds = payload.memberIds.filter((id) => friends.value.some((f) => f.id === id));
    if (memberIds.length < 2) return null;
    const group: GroupChat = {
      id: uid("g"),
      name: payload.name.trim() || "群聊",
      memberIds,
      avatarSeed: payload.name.trim() || "群聊",
      createdAt: Date.now(),
    };
    groups.value.push(group);
    try {
      await settings.buildClient().plusCreateGroup({ id: group.id, name: group.name, memberIds });
    } catch {
      /* best-effort */
    }
    return group;
  }

  async function removeGroup(id: string): Promise<void> {
    const group = groups.value.find((g) => g.id === id);
    groups.value = groups.value.filter((g) => g.id !== id);
    delete threads.value[keyOf("group", id)];
    delete unread.value[keyOf("group", id)];
    if (activeKey.value === keyOf("group", id)) activeKey.value = "";
    const client = settings.buildClient();
    // Each group member keeps its own UMO / conversation — delete them all so the
    // server side is cleaned up together with the local thread.
    try {
      const umos = (group?.memberIds ?? []).map((m) => groupMemberUmo(id, m));
      if (umos.length) await client.deleteConversationsByUmo(umos);
    } catch {
      /* best-effort */
    }
    try {
      await client.plusDeleteGroup(id);
    } catch {
      /* best-effort */
    }
  }

  function memberName(groupId: string, memberId: string): string {
    const g = groups.value.find((x) => x.id === groupId);
    if (!g) return memberId;
    return friends.value.find((f) => f.id === memberId)?.name || memberId;
  }

  // --- Registry sync (companion plugin) ------------------------------------

  async function loadContacts(_opts: { detectNew?: boolean } = {}): Promise<void> {
    if (!settings.hasCredentials) return;
    loadingContacts.value = true;
    contactsError.value = "";
    try {
      const client = settings.buildClient();
      const [users, grps] = await Promise.all([
        client.plusListUsers().catch(() => null),
        client.plusListGroups().catch(() => null),
      ]);
      if (Array.isArray(users) && users.length) {
        friends.value = users.map((u) => ({
          id: u.id || uid("f"),
          name: u.name || "AI 好友",
          configId: u.configId,
          personaId: u.personaId,
          avatarSeed: u.avatarSeed || u.name || "AI",
          createdAt: u.createdAt || Date.now(),
        }));
      }
      if (Array.isArray(grps) && grps.length) {
        groups.value = grps.map((g) => ({
          id: g.id || uid("g"),
          name: g.name || "群聊",
          memberIds: Array.isArray(g.memberIds) ? g.memberIds : [],
          avatarSeed: g.avatarSeed || g.name || "群聊",
          createdAt: g.createdAt || Date.now(),
        }));
      }
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

  /**
   * Send a message in the active chat. In a group the text fans out to every
   * member concurrently, and each member keeps its OWN session/conversation so
   * the AIs never share a context.
   */
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

    const client = settings.buildClient();
    // Escape a literal leading "/" so the server's wake-prefix stripping does not
    // swallow it before the LLM sees the message.
    const serverText = escapeLeadingSlash(body);

    if (target.kind === "friend") {
      const friend = target.friend!;
      const assistant: ChatMessage = {
        role: "assistant",
        text: "",
        created_at: new Date().toISOString(),
        streaming: true,
        senderId: friend.id,
        senderName: friend.name,
      };
      thread.messages.push(assistant);
      thread.busy = true;
      try {
        await client.chatStream(
          {
            username: friendUmo(friend.id),
            message: serverText,
            sessionId: thread.sessions[friend.id],
            conversationId: thread.conversations[friend.id],
            platformId: "webchat",
          },
          {
            onSessionId: (sid) => {
              thread.sessions[friend.id] = sid;
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
        assistant.text = `发送失败：${errMsg(e)}`;
      } finally {
        assistant.streaming = false;
        thread.busy = false;
        thread.updatedAt = Date.now();
      }
      // If the user has since switched to another chat, flag this reply as unread
      // so the list shows a badge for it.
      if (activeKey.value !== key && assistant.text && !assistant.error) bumpUnread(key);
      return;
    }

    // Group chat: independent context per member.
    const group = target.group!;
    const members = group.memberIds
      .map((id) => friends.value.find((f) => f.id === id))
      .filter((x): x is AiFriend => !!x);
    thread.busy = true;

    let replied = 0;
    const jobs = members.map(async (friend) => {
      const assistant: ChatMessage = {
        role: "assistant",
        text: "",
        created_at: new Date().toISOString(),
        streaming: true,
        senderId: friend.id,
        senderName: friend.name,
      };
      thread.messages.push(assistant);
      try {
        await client.chatStream(
          {
            username: groupMemberUmo(group.id, friend.id),
            message: serverText,
            sessionId: thread.sessions[friend.id],
            conversationId: thread.conversations[friend.id],
            platformId: "webchat",
          },
          {
            onSessionId: (sid) => {
              thread.sessions[friend.id] = sid;
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
        replied += 1;
      } catch (e) {
        assistant.error = true;
        assistant.text = `发送失败：${errMsg(e)}`;
      } finally {
        assistant.streaming = false;
      }
    });

    await Promise.all(jobs);
    thread.busy = false;
    thread.updatedAt = Date.now();
    thread.lastMessage = body;
    // Same as the 1:1 case: badge the thread if the user moved on while the group
    // was answering.
    if (activeKey.value !== key && replied > 0) bumpUnread(key);
  }

  return {
    friends,
    groups,
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
    groupCount,
    loadingContacts,
    contactsError,
    loadContacts,
    startPolling,
    stopPolling,
    openTarget,
    markRead,
    markUnread,
    bumpUnread,
    unreadOf,
    addFriend,
    removeFriend,
    createGroup,
    removeGroup,
    memberName,
    clearThread,
    sendMessage,
    friendUmo,
    groupMemberUmo,
  };
});
