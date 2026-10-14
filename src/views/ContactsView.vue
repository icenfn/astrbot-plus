<script setup lang="ts">
import { computed, ref } from "vue";
import AstrbotAvatar from "@/components/AstrbotAvatar.vue";

// UI-only page (no wiring yet). Layout is inspired by WeChat / Telegram:
// a search field, a few pinned quick actions, then contacts grouped A–Z.

interface Contact {
  name: string;
  seed: string;
  desc?: string;
}

const query = ref("");

const quick = [
  { name: "新的朋友", icon: "mdi-account-plus", color: "warning" },
  { name: "群聊", icon: "mdi-account-group", color: "success" },
  { name: "标签", icon: "mdi-tag", color: "info" },
];

const people: Contact[] = [
  { name: "阿斯特", seed: "astra", desc: "在 AstrBot 相遇" },
  { name: "Bot 小助手", seed: "bot", desc: "官方助手账号" },
  { name: "白露", seed: "bailu", desc: "一切都会好起来的" },
  { name: "陈默", seed: "chenmo", desc: "沉默是金" },
  { name: "丁一", seed: "dingyi", desc: "简单生活" },
  { name: "风信子", seed: "fengxinzi", desc: "花开有时" },
  { name: "顾清", seed: "guqing", desc: "清心寡欲" },
  { name: "海鸥", seed: "haiou", desc: "飞向远方" },
  { name: "纪南", seed: "jinan", desc: "南风知我意" },
  { name: "柯蓝", seed: "kelan", desc: "蓝色心情" },
];

const groups = computed(() => {
  const map = new Map<string, Contact[]>();
  for (const p of people) {
    if (query.value && !p.name.includes(query.value)) continue;
    const first = p.name[0] ?? "#";
    const letter = /[a-zA-Z]/.test(first) ? first.toUpperCase() : "#";
    if (!map.has(letter)) map.set(letter, []);
    map.get(letter)!.push(p);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([letter, contacts]) => ({ letter, contacts }));
});
</script>

<template>
  <div class="contacts">
    <v-text-field
      v-model="query"
      class="contacts-search"
      placeholder="搜索联系人"
      prepend-inner-icon="mdi-magnify"
      variant="solo-filled"
      density="comfortable"
      hide-details
      flat
      clearable
    />

    <div class="contacts-scroll chat-scroll">
      <v-list class="contacts-list" lines="two">
        <v-list-item v-for="q in quick" :key="q.name" :title="q.name" link>
          <template #prepend>
            <v-avatar :color="q.color" size="44" rounded="lg">
              <v-icon :icon="q.icon" color="white" />
            </v-avatar>
          </template>
        </v-list-item>

        <template v-for="group in groups" :key="group.letter">
          <v-list-subheader>{{ group.letter }}</v-list-subheader>
          <v-list-item
            v-for="c in group.contacts"
            :key="c.name"
            :title="c.name"
            :subtitle="c.desc"
            link
          >
            <template #prepend>
              <AstrbotAvatar :name="c.name" :seed="c.seed" :size="44" />
            </template>
          </v-list-item>
        </template>
      </v-list>
    </div>
  </div>
</template>

<style scoped>
.contacts {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-background));
}
.contacts-search {
  flex: 0 0 auto;
  padding: 8px 12px;
}
.contacts-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
.contacts-list {
  background: transparent;
}
</style>
