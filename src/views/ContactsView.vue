<script setup lang="ts">
import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { useChatStore } from "@/stores/chat";
import { useSettingsStore } from "@/stores/settings";
import AstrbotAvatar from "@/components/AstrbotAvatar.vue";

const chat = useChatStore();
const settings = useSettingsStore();
const router = useRouter();
const { contacts, filteredContacts, search, friendCount, groupCount } = storeToRefs(chat);

function fmt(ts: number): string {
  if (!ts) return "-";
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}

onMounted(() => {
  if (settings.hasCredentials && !contacts.value.length) chat.loadContacts();
});

function open(umo: string) {
  const c = contacts.value.find((x) => x.umo === umo);
  if (c) {
    chat.openContact(c);
    router.push("/");
  }
}
</script>

<template>
  <div class="contacts-view">
    <header class="head">
      <div>
        <h2 class="title">会话列表</h2>
        <p class="sub text-medium-emphasis">
          共 {{ contacts.length }} 个会话 · 单聊 {{ friendCount }} · 群聊 {{ groupCount }}
        </p>
      </div>
      <v-spacer />
      <v-text-field
        v-model="search"
        placeholder="搜索"
        prepend-inner-icon="mdi-magnify"
        density="compact"
        variant="solo-filled"
        flat
        hide-details
        clearable
        class="search"
      />
      <v-btn
        prepend-icon="mdi-refresh"
        variant="tonal"
        :loading="chat.loadingContacts"
        @click="chat.loadContacts()"
      >
        刷新
      </v-btn>
    </header>

    <v-alert
      v-if="chat.contactsError"
      type="error"
      variant="tonal"
      density="compact"
      class="ma-4"
      :text="chat.contactsError"
    />

    <div class="table">
      <div class="row header-row">
        <span>会话</span>
        <span>平台</span>
        <span>类型</span>
        <span class="num">Token</span>
        <span>最近活跃</span>
      </div>
      <button
        v-for="c in filteredContacts"
        :key="c.umo"
        class="row body-row"
        @click="open(c.umo)"
      >
        <span class="cell name">
          <AstrbotAvatar
            :name="c.displayName"
            :seed="c.avatarSeed"
            :group="c.messageType === 'GroupMessage'"
            :size="34"
          />
          <span class="ellipsis">{{ c.displayName }}</span>
        </span>
        <span class="cell">{{ c.platform }}</span>
        <span class="cell">
          <v-chip
            size="x-small"
            :color="c.messageType === 'GroupMessage' ? 'primary' : 'secondary'"
            variant="tonal"
            label
          >
            {{ c.messageType === "GroupMessage" ? "群聊" : "单聊" }}
          </v-chip>
        </span>
        <span class="cell num">-</span>
        <span class="cell">{{ fmt(c.updatedAt) }}</span>
      </button>

      <div v-if="!filteredContacts.length" class="empty text-medium-emphasis">
        暂无会话数据
      </div>
    </div>
  </div>
</template>

<style scoped>
.contacts-view {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px 12px;
}
.title {
  font-size: 20px;
  font-weight: 700;
}
.sub {
  font-size: 12.5px;
}
.search {
  max-width: 260px;
}
.table {
  margin: 0 24px 24px;
  border: 1px solid rgba(128, 150, 170, 0.18);
  border-radius: 14px;
  overflow: hidden;
}
.row {
  display: grid;
  grid-template-columns: 2.2fr 1fr 1fr 0.8fr 1.4fr;
  gap: 10px;
  align-items: center;
  padding: 10px 16px;
  text-align: left;
  width: 100%;
}
.header-row {
  background: rgba(47, 134, 189, 0.1);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  opacity: 0.85;
}
.body-row {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  border-top: 1px solid rgba(128, 150, 170, 0.1);
}
.body-row:hover {
  background: rgba(47, 134, 189, 0.08);
}
.cell {
  font-size: 13.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cell.name {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cell.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
}
.empty {
  padding: 28px;
  text-align: center;
}
</style>
