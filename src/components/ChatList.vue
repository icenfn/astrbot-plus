<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useChatStore } from "@/stores/chat";

const chat = useChatStore();
const { contacts, activeUmo, filteredContacts, loadingContacts, contactsError, filter, search } =
  storeToRefs(chat);

const filters = [
  { label: "全部", value: "all" as const, icon: "mdi-format-list-bulleted" },
  { label: "单聊", value: "FriendMessage" as const, icon: "mdi-account" },
  { label: "群聊", value: "GroupMessage" as const, icon: "mdi-account-group" },
];

async function refresh() {
  await chat.loadContacts();
}
</script>

<template>
  <section class="list-pane">
    <header class="head">
      <div class="head-top">
        <h2 class="title">AstrBot+</h2>
        <v-btn icon="mdi-refresh" size="small" variant="text" :loading="loadingContacts" @click="refresh" />
      </div>
      <v-text-field
        v-model="search"
        placeholder="搜索会话"
        prepend-inner-icon="mdi-magnify"
        density="compact"
        variant="solo-filled"
        flat
        hide-details
        clearable
        class="search"
      />
      <div class="chips">
        <v-chip
          v-for="f in filters"
          :key="f.value"
          :prepend-icon="f.icon"
          size="small"
          :variant="filter === f.value ? 'flat' : 'tonal'"
          :color="filter === f.value ? 'primary' : undefined"
          @click="chat.filter = f.value"
        >
          {{ f.label }}
        </v-chip>
      </div>
    </header>

    <div class="scroll">
      <v-alert
        v-if="contactsError"
        type="error"
        variant="tonal"
        density="compact"
        class="ma-3"
        :text="contactsError"
      />

      <div v-if="loadingContacts && !contacts.length" class="center">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <div v-else-if="!filteredContacts.length" class="empty">
        <v-icon icon="mdi-message-text-outline" size="40" class="mb-2" />
        <p class="text-medium-emphasis">暂无会话</p>
        <p class="text-caption text-medium-emphasis text-center">
          在 AstrBot 中产生对话后，会话会显示在这里。
        </p>
      </div>

      <div v-else class="items">
        <ContactItem
          v-for="c in filteredContacts"
          :key="c.umo"
          :contact="c"
          :active="c.umo === activeUmo"
          @select="chat.openContact($event)"
        />
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import ContactItem from "./ContactItem.vue";
export default { components: { ContactItem } };
</script>

<style scoped>
.list-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgb(var(--v-theme-surface));
}
.head {
  padding: 14px 14px 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.head-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.2px;
}
.search {
  margin-top: 2px;
}
.chips {
  display: flex;
  gap: 8px;
}
.scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 4px 6px 10px;
}
.items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.center {
  display: grid;
  place-items: center;
  padding: 40px 0;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 20px;
}
</style>
