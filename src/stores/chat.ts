/**
 * Chat store — unified Agent + User (friend) conversations.
 *
 * Peers:
 *   • Agent (bot) — directory from `GET /api/agents`; messages stream over
 *     Socket.io `chat:send` / `chat:delta` / `chat:done`.
 *   • User (friend) — directory from `GET /api/users`; one-to-one messages over
 *     `private:send` / `private:message`.
 *
 * A peer is identified by a `peerKey`:
 *   • Agent → the agent id itself (e.g. "astrid")
 *   • User  → `user_<userId>` (e.g. "user_42")
 *
 * The route `/chat/:id` carries this peerKey verbatim, so opening a friend
 * chat navigates to `/chat/user_42` and opening an agent chat to `/chat/astrid`.
 *
 * Conversations are cached in local SQLite (offline read); server history is
 * always authoritative and fetched via `GET /api/messages` when a thread opens.
 */
import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";
import { useEventListener } from "@vueuse/core";
import type {
  AgentRow,
  ChatMessage,
  HistoryMessage,
  PeerType,
  PrivateMessage,
  UserRow,
} from "@/api/types";
import { notify } from "@/composables/useNotify";
import {
  cacheMessages,
  loadCachedMessages,
  cachePinned,
  loadCachedPinned,
  cacheConversationStarted,
  loadCachedStarted,
} from "@/api/cache";
import { fetchHistory, listAgents, listFriends } from "@/api/http";
import { useSettingsStore } from "./settings";

/** Cap a thread's retained messages to keep memory bounded. */
const THREAD_LIMIT = 500;

// ---- peer key helpers ----------------------------------------------------

export function userPeerKey(userId: string): string {
  return `user_${userId}`;
}

export function parsePeerKey(key: string): { peerType: PeerType; peerId: string } {
  if (key.startsWith("user_")) {
    return { peerType: "user", peerId: key.slice("user_".length) };
  }
  return { peerType: "agent", peerId: key };
}

function tsToIso(ts?: number): string {
  return new Date((ts ?? Date.now() / 1000) * 1000).toISOString();
}

// ---- unified peer metadata (drives the conversation list) ---------------

interface PeerMeta {
  key: string;
  peerType: PeerType;
  peerId: string;
  name: string;
  /** 头像（data-URI / URL）；空串表示使用内置默认头像。 */
  avatar: string;
  updatedAt: number;
  lastMessage?: string;
  messageCount: number;
}

export const useChatStore = defineStore("chat", () => {
  // Directories (from HTTP API) — separate from the conversation list.
  const agents = ref<AgentRow[]>([]);
  const friends = ref<UserRow[]>([]);

  // Unified peer metadata, keyed by peerKey. Seeded from directories and
  // updated by incoming messages / streaming.
  const peers = ref<Record<string, PeerMeta>>({});

  const threads = ref<Record<string, ChatMessage[]>>({});
  const unread = ref<Record<string, number>>({});
  const pinned = ref<Record<string, boolean>>({});
  /**
   * Peers whose conversation has actually been started (history on server, or
   * the user opened the thread). Only these appear in the message list.
   */
  const started = ref<Record<string, boolean>>({});
  const activeKey = ref<string>("");
  const loadingContacts = ref(false);
  const contactsError = ref("");
  const sending = ref(false);

  // Outgoing private messages keyed by reqId, so we can correlate the server
  // echo (`private:message` with fromUserId === me) back to the optimistic row.
  const pendingOutgoing = new Map<string, { peerKey: string; text: string }>();

  // Peers whose server history has already been pulled this session.
  const historySynced = new Set<string>();

  let feedBound = false;
  let focusBound = false;

  // ---- selectors -----------------------------------------------------------

  const conversationRows = computed<PeerMeta[]>(() => {
    const rows = Object.values(peers.value)
      // 已开始的会话，或本地/服务端已有历史消息的会话，都应出现在列表里
      .filter((p) => started.value[p.key] || (threads.value[p.key]?.length ?? 0) > 0)
      .slice();
    rows.sort((a, b) => {
      const pa = pinned.value[a.key] ? 1 : 0;
      const pb = pinned.value[b.key] ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return b.updatedAt - a.updatedAt;
    });
    return rows;
  });

  const activePeer = computed<PeerMeta | null>(() =>
    activeKey.value ? peers.value[activeKey.value] ?? null : null,
  );

  const activeThread = computed(() => {
    const id = activeKey.value;
    const messages = id ? threads.value[id] ?? [] : [];
    return { messages, busy: sending.value };
  });

  const totalUnread = computed(() =>
    Object.values(unread.value).reduce((sum, n) => sum + n, 0),
  );

  // ---- unread / pinned -----------------------------------------------------

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

  function isPinned(id: string): boolean {
    return !!pinned.value[id];
  }

  function togglePinned(id: string): void {
    if (!id) return;
    pinned.value = { ...pinned.value, [id]: !pinned.value[id] };
    void cachePinned(pinned.value);
  }

  // ---- peer lifecycle ------------------------------------------------------

  function upsertPeer(
    meta: Omit<PeerMeta, "updatedAt" | "messageCount"> &
      Partial<Pick<PeerMeta, "updatedAt" | "messageCount">>,
  ): PeerMeta {
    const existing = peers.value[meta.key];
    const next: PeerMeta = {
      key: meta.key,
      peerType: meta.peerType,
      peerId: meta.peerId,
      name: meta.name,
      avatar: meta.avatar,
      lastMessage: meta.lastMessage ?? existing?.lastMessage,
      updatedAt: meta.updatedAt ?? existing?.updatedAt ?? Date.now(),
      messageCount: meta.messageCount ?? existing?.messageCount ?? 0,
    };
    peers.value = { ...peers.value, [meta.key]: next };
    return next;
  }

  function ensureThread(id: string): ChatMessage[] {
    if (!threads.value[id]) threads.value[id] = [];
    return threads.value[id];
  }

  function pushMessage(id: string, message: ChatMessage): void {
    const list = ensureThread(id);
    list.push(message);
    if (list.length > THREAD_LIMIT) list.splice(0, list.length - THREAD_LIMIT);
    void cacheMessages(id, list);
  }

  function isForeground(): boolean {
    return document.visibilityState === "visible" && document.hasFocus();
  }

  /** Update a peer's list-row metadata from a new incoming message. */
  function touchPeer(
    key: string,
    text: string,
    ts?: number,
    extra?: Partial<Pick<PeerMeta, "name" | "avatar" | "peerType" | "peerId">>,
  ): PeerMeta {
    const existing = peers.value[key];
    const base: PeerMeta = existing ?? {
      key,
      peerType: parsePeerKey(key).peerType,
      peerId: parsePeerKey(key).peerId,
      name: extra?.name ?? key,
      avatar: extra?.avatar ?? "",
      updatedAt: Date.now(),
      messageCount: 0,
    };
    const next: PeerMeta = {
      ...base,
      ...(extra ?? {}),
      lastMessage: text,
      updatedAt: (ts ?? Date.now() / 1000) * 1000,
      messageCount: base.messageCount + 1,
    };
    peers.value = { ...peers.value, [key]: next };
    return next;
  }

  // ---- incoming message handling ------------------------------------------

  /**
   * Apply an incoming `message:new` broadcast (agent or user). This drives
   * the list subtitle / unread badge / system notification, and mirrors the
   * bubble into the open thread when applicable.
   */
  function receiveMessage(msg: HistoryMessage): void {
    const peerType = msg.peerType ?? "agent";
    const peerId = msg.peerId ?? msg.botId ?? "";
    if (!peerId) return;
    const key = peerType === "user" ? userPeerKey(peerId) : peerId;
    const text = msg.text ?? "";
    if (!text) return;

    touchPeer(key, text, msg.ts);

    // Mirror into the open thread (non-user-role messages only; our own
    // echoes are handled by private:message).
    const isActive = activeKey.value === key;
    if (isActive && msg.role !== "user") {
      const list = ensureThread(key);
      const last = list[list.length - 1];
      if (!(last && last.role === "assistant" && last.text === text)) {
        pushMessage(key, { role: msg.role, text, created_at: tsToIso(msg.ts) });
      }
    }

    const focusedHere = isActive && isForeground();
    if (!focusedHere) {
      markUnread(key);
      const settings = useSettingsStore();
      if (settings.settings.notifyEnabled && msg.role !== "user") {
        const row = peers.value[key];
        void notify({
          title: row?.name ?? key,
          body: text,
          onlyWhenUnfocused: settings.settings.notifyOnlyBackground,
          onClick: () => {
            activeKey.value = key;
            markRead(key);
          },
        });
      }
    }
  }

  /**
   * Apply a `private:message` push.
   *
   * The payload carries `toUserId`, so we don't need the pending map to find
   * the peer — but we DO use it to correlate our own optimistic send (when
   * `fromUserId === me`) back to the row we already inserted, instead of
   * appending a duplicate.
   */
  function receivePrivateMessage(msg: PrivateMessage): void {
    const settings = useSettingsStore();
    const me = settings.settings.currentUser?.id ?? "";
    const text = msg.text ?? "";
    if (!text) return;

    let key: string;
    let incoming: boolean;
    if (msg.fromUserId === me) {
      // My own echo. Peer is the recipient.
      key = userPeerKey(msg.toUserId ?? "");
      incoming = false;
    } else {
      // Incoming from a friend.
      key = userPeerKey(msg.fromUserId);
      incoming = true;
    }
    if (!key || key === "user_") return;

    // Upsert the peer row so the name is known.
    const existing = peers.value[key];
    if (!existing) {
      // Try to enrich from the friends directory.
      const friend = friends.value.find((f) => f.id === msg.fromUserId);
      upsertPeer({
        key,
        peerType: "user",
        peerId: parsePeerKey(key).peerId,
        name: msg.fromUsername ?? friend?.username ?? parsePeerKey(key).peerId,
        avatar: friend?.avatar ?? "",
      });
    }

    if (incoming) {
      touchPeer(key, text, msg.ts);
      // Mirror into the open thread.
      const isActive = activeKey.value === key;
      const list = ensureThread(key);
      list.push({
        role: "assistant",
        text,
        created_at: tsToIso(msg.ts),
        serverId: msg.id,
      });
      if (list.length > THREAD_LIMIT) list.splice(0, list.length - THREAD_LIMIT);
      void cacheMessages(key, list);

      if (!(isActive && isForeground())) {
        markUnread(key);
        if (settings.settings.notifyEnabled) {
          const row = peers.value[key];
          void notify({
            title: row?.name ?? key,
            body: text,
            onlyWhenUnfocused: settings.settings.notifyOnlyBackground,
            onClick: () => {
              activeKey.value = key;
              markRead(key);
            },
          });
        }
      }
    } else {
      // My own echo: find the optimistic row by reqId (or fallback by text)
      // and upgrade it with the server id / timestamp.
      const list = ensureThread(key);
      const reqId = msg.reqId;
      let idx = -1;
      if (reqId) {
        idx = list.findIndex((m) => m.pendingReqId === reqId);
      }
      if (idx < 0) {
        // Fallback: last outgoing bubble with the same text within 5s.
        const cutoff = Date.now() - 5000;
        for (let i = list.length - 1; i >= 0; i--) {
          const m = list[i];
          if (m.role === "user" && m.text === text && new Date(m.created_at).getTime() > cutoff) {
            idx = i;
            break;
          }
        }
      }
      if (idx >= 0) {
        list[idx].created_at = tsToIso(msg.ts);
        list[idx].serverId = msg.id;
        list[idx].pendingReqId = undefined;
      } else {
        // Echo we didn't optimistically predict (e.g. sent from another device).
        list.push({
          role: "user",
          text,
          created_at: tsToIso(msg.ts),
          serverId: msg.id,
        });
      }
      void cacheMessages(key, list);
      // Update list row for outgoing too.
      touchPeer(key, text, msg.ts);
    }
  }

  // ---- socket feed ---------------------------------------------------------

  function bindFeed(): void {
    const settings = useSettingsStore();
    if (!settings.connected) return;
    if (feedBound) return;
    feedBound = true;
    settings.getSocket().on("message:new", (raw) => {
      if (raw && typeof raw === "object") receiveMessage(raw as HistoryMessage);
    });
    settings.getSocket().on("private:message", (raw) => {
      if (raw && typeof raw === "object") {
        receivePrivateMessage(raw as PrivateMessage);
      }
    });
    settings.getSocket().on("bots:changed", () => {
      void loadContacts();
    });
    if (!focusBound) {
      focusBound = true;
      useEventListener(window, "focus", () => void loadContacts());
      useEventListener(document, "visibilitychange", () => {
        if (!document.hidden) void loadContacts();
      });
    }
  }

  // ---- directory ------------------------------------------------------------

  async function loadContacts(): Promise<void> {
    const settings = useSettingsStore();
    if (!settings.connected) return;
    loadingContacts.value = true;
    contactsError.value = "";
    try {
      const [agentList, userList] = await Promise.all([
        listAgents().catch(() => [] as AgentRow[]),
        listFriends().catch(() => [] as UserRow[]),
      ]);
      agents.value = Array.isArray(agentList) ? agentList : [];
      friends.value = Array.isArray(userList) ? userList : [];

      // Seed peer metadata for agents (do NOT auto-mark started — only agents
      // with history or that the user opened appear in the list).
      for (const a of agents.value) {
        upsertPeer({
          key: a.id,
          peerType: "agent",
          peerId: a.id,
          name: a.name,
          avatar: a.avatar ?? "",
        });
      }
      // Seed peer metadata for friends too (so opening a friend chat works
      // even before any message lands).
      for (const u of friends.value) {
        const key = userPeerKey(u.id);
        upsertPeer({
          key,
          peerType: "user",
          peerId: u.id,
          name: u.username,
          avatar: u.avatar ?? "",
        });
      }
      bindFeed();
    } catch (e) {
      contactsError.value = e instanceof Error ? e.message : String(e);
    } finally {
      loadingContacts.value = false;
    }
  }

  // ---- local cache ----------------------------------------------------------

  async function restoreCache(): Promise<void> {
    const cachedPins = await loadCachedPinned();
    if (Object.keys(cachedPins).length) {
      pinned.value = { ...cachedPins, ...pinned.value };
    }
    const cachedStarted = await loadCachedStarted();
    if (Object.keys(cachedStarted).length) {
      started.value = { ...cachedStarted, ...started.value };
    }
  }

  // ---- history --------------------------------------------------------------

  async function loadHistory(key: string, force = false): Promise<void> {
    if (!key) return;
    const settings = useSettingsStore();
    const { peerType, peerId } = parsePeerKey(key);

    // 1) Render local cache immediately when the thread is empty.
    let local = threads.value[key] ?? [];
    if (!local.length) {
      const cached = await loadCachedMessages(key);
      if (cached.length) {
        threads.value[key] = cached;
        local = cached;
      }
    }

    // 2) Pull server history once per peer (unless forced).
    const alreadySynced = historySynced.has(key) && !force;
    if (!settings.connected || alreadySynced) return;

    let history: HistoryMessage[] = [];
    try {
      history = await fetchHistory(peerType, peerId, undefined, 50);
      historySynced.add(key);
    } catch {
      return; // keep serving the cache
    }

    // 3) Merge: server rows are authoritative; local-only optimistic rows are
    //    kept. Dedupe on role+text+second.
    const threadKey = (role: string, text: string, iso: string): string => {
      const t = new Date(iso).getTime();
      return `${role}\u0000${text}\u0000${Number.isNaN(t) ? iso : Math.floor(t / 1000)}`;
    };
    const seen = new Set<string>();
    const merged: ChatMessage[] = [];
    const me = settings.settings.currentUser?.id ?? "";
    for (const m of history) {
      // Map the service row's role. The API returns role already, but for
      // private chats we normalise based on fromUserId when role is absent.
      let role = m.role;
      if (!role) {
        role = m.fromUserId === me ? "user" : "assistant";
      }
      const item: ChatMessage = {
        role,
        text: m.text,
        created_at: tsToIso(m.ts),
        serverId: m.id,
      };
      const k = threadKey(item.role, item.text, item.created_at);
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(item);
    }
    for (const m of local) {
      const k = threadKey(m.role, m.text, m.created_at);
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(m);
    }
    merged.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    if (merged.length > THREAD_LIMIT) merged.splice(0, merged.length - THREAD_LIMIT);

    threads.value[key] = merged;
    // Refresh the list row's last message.
    if (merged.length) {
      const last = merged[merged.length - 1];
      const row = peers.value[key];
      if (row) {
        row.lastMessage = last.text;
        row.updatedAt = new Date(last.created_at).getTime();
        row.messageCount = merged.length;
      }
    }
    void cacheMessages(key, merged);
  }

  // ---- open / close ---------------------------------------------------------

  function markConversationStarted(key: string): void {
    if (!key || started.value[key]) return;
    started.value = { ...started.value, [key]: true };
    void cacheConversationStarted(key, true);
  }

  function openPeer(key: string): void {
    activeKey.value = key;
    markConversationStarted(key);
    markRead(key);
    void loadHistory(key);
  }

  function closeActive(): void {
    activeKey.value = "";
  }

  async function deleteConversation(key: string): Promise<boolean> {
    if (!key) return false;
    try {
      const { deleteCachedConversation } = await import("@/api/cache");
      await deleteCachedConversation(key);
    } catch {
      /* best-effort */
    }
    delete threads.value[key];
    delete unread.value[key];
    delete pinned.value[key];
    delete peers.value[key];
    historySynced.delete(key);
    if (activeKey.value === key) activeKey.value = "";
    void cachePinned(pinned.value);
    return true;
  }

  // ---- send -----------------------------------------------------------------

  async function sendMessage(text: string): Promise<void> {
    const key = activeKey.value;
    const content = text.trim();
    if (!key || !content || sending.value) return;

    const settings = useSettingsStore();
    if (!settings.connected) return;

    const peer = peers.value[key];
    if (!peer) return;

    // ---- private message to another user -----------------------------------
    if (peer.peerType === "user") {
      const optimisticReqId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const optimistic: ChatMessage = {
        role: "user",
        text: content,
        created_at: new Date().toISOString(),
        pendingReqId: optimisticReqId,
      };
      pushMessage(key, optimistic);
      touchPeer(key, content);
      pendingOutgoing.set(optimisticReqId, { peerKey: key, text: content });
      try {
        await settings.getSocket().sendPrivate(peer.peerId, content);
      } catch (e) {
        optimistic.error = true;
        optimistic.text = `${content}\n[发送失败: ${e instanceof Error ? e.message : String(e)}]`;
        void cacheMessages(key, threads.value[key] ?? []);
      }
      return;
    }

    // ---- streaming chat with an Agent --------------------------------------
    pushMessage(key, { role: "user", text: content, created_at: new Date().toISOString() });
    touchPeer(key, content);
    sending.value = true;

    let assistant: ChatMessage | null = null;
    let settled = false;
    const ensureAssistant = (): ChatMessage => {
      if (!assistant) {
        assistant = reactive<ChatMessage>({
          role: "assistant",
          text: "",
          created_at: new Date().toISOString(),
        });
        pushMessage(key, assistant);
      }
      return assistant;
    };
    const finishAssistant = (full: string): void => {
      if (assistant) {
        assistant.text = full || assistant.text;
        return;
      }
      const list = ensureThread(key);
      const last = list[list.length - 1];
      if (last && last.role === "assistant" && last.text === full) return;
      pushMessage(key, { role: "assistant", text: full, created_at: new Date().toISOString() });
    };

    try {
      const cleanup = settings.getSocket().sendChat(
        { botId: peer.peerId, text: content },
        {
          onDelta: (_delta, full) => {
            ensureAssistant().text = full;
          },
          onDone: (full) => {
            finishAssistant(full);
            settled = true;
          },
          onError: (err) => {
            const msg = ensureAssistant();
            msg.text = err.message;
            msg.error = true;
            settled = true;
          },
        },
      );
      await new Promise<void>((resolve) => {
        let resolved = false;
        const finish = () => {
          if (resolved) return;
          resolved = true;
          window.clearInterval(timer);
          window.clearTimeout(watchdog);
          cleanup();
          resolve();
        };
        const timer = window.setInterval(() => {
          if (settled) finish();
        }, 80);
        const watchdog = window.setTimeout(finish, 45000);
      });
    } catch (e) {
      const msg = ensureAssistant();
      msg.text = e instanceof Error ? e.message : String(e);
      msg.error = true;
    } finally {
      sending.value = false;
      void cacheMessages(key, threads.value[key] ?? []);
    }
  }

  return {
    // state
    agents,
    friends,
    peers,
    threads,
    unread,
    pinned,
    started,
    activeKey,
    loadingContacts,
    contactsError,
    sending,
    // getters
    activePeer,
    activeThread,
    totalUnread,
    conversationRows,
    // helpers
    unreadOf,
    isPinned,
    togglePinned,
    markConversationStarted,
    markRead,
    receiveMessage,
    receivePrivateMessage,
    bindFeed,
    loadContacts,
    restoreCache,
    loadHistory,
    openPeer,
    closeActive,
    deleteConversation,
    sendMessage,
  };
});
