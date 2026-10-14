<script setup lang="ts">
import { computed } from "vue";
import AstrbotAvatar from "@/components/AstrbotAvatar.vue";

// UI-only page (no wiring yet). Layout is inspired by WeChat / Telegram:
// a few pinned quick actions, a pinned「✦Agents」group, then contacts grouped
// A–Z. The top search box and its filter logic were removed, as was the「标签」
// shortcut.

interface Contact {
  name: string;
  seed: string;
  desc?: string;
}

const quick = [
  { name: "新的朋友", icon: "mdi-account-plus", color: "warning" },
  { name: "群聊", icon: "mdi-account-group", color: "success" },
];

// Agents (bots created in the AstrBot WebUI) get their own pinned group.
const agents: Contact[] = [
  { name: "阿斯特", seed: "astra-agent", desc: "AstrBot Agent" },
  { name: "Bot 小助手", seed: "bot-agent", desc: "AstrBot Agent" },
  { name: "写作助手", seed: "writer-agent", desc: "AstrBot Agent" },
];

const people: Contact[] = [
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
    <div class="contacts-scroll chat-scroll">
      <v-list class="contacts-list" lines="two">
        <v-list-item v-for="q in quick" :key="q.name" :title="q.name" link>
          <template #prepend>
            <v-avatar :color="q.color" size="44" rounded="lg">
              <v-icon :icon="q.icon" color="white" />
            </v-avatar>
          </template>
        </v-list-item>

        <!-- ✦Agents — 置顶分组，展示 WebUI 创建的 Agent -->
        <v-list-subheader>✦Agents</v-list-subheader>
        <v-list-item
          v-for="a in agents"
          :key="a.name"
          :title="a.name"
          :subtitle="a.desc"
          link
        >
          <template #prepend>
            <AstrbotAvatar :name="a.name" :seed="a.seed" :size="44" />
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
.contacts-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
.contacts-list {
  background: transparent;
}
</style>
