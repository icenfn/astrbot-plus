<script setup lang="ts">
import { computed } from "vue";
import AstrbotAvatar from "@/components/AstrbotAvatar.vue";

// UI-only page (no wiring yet). Layout is inspired by WeChat / Telegram:
// a few pinned quick actions, a pinned「✦ Agents」group, then contacts grouped
// A–Z. The top search box and its filter logic were removed, as were the「标签」
// shortcut and the fallback「#」(other/symbols) group — every contact now carries
// an explicit A–Z `initial`, so no「#」bucket is ever produced.

interface Contact {
  name: string;
  seed: string;
  /** A–Z bucket for this contact (pinyin initial for Chinese names). */
  initial: string;
  desc?: string;
}

const quick = [
  { name: "新的朋友", icon: "mdi-account-plus", color: "warning" },
  { name: "群聊", icon: "mdi-account-group", color: "success" },
];

// Agents (bots created in the AstrBot WebUI) get their own pinned group.
const agents: Contact[] = [
  { name: "阿斯特", seed: "astra-agent", initial: "A", desc: "AstrBot Agent" },
  { name: "Bot 小助手", seed: "bot-agent", initial: "B", desc: "AstrBot Agent" },
  { name: "写作助手", seed: "writer-agent", initial: "X", desc: "AstrBot Agent" },
];

const people: Contact[] = [
  { name: "白露", seed: "bailu", initial: "B", desc: "一切都会好起来的" },
  { name: "陈默", seed: "chenmo", initial: "C", desc: "沉默是金" },
  { name: "丁一", seed: "dingyi", initial: "D", desc: "简单生活" },
  { name: "风信子", seed: "fengxinzi", initial: "F", desc: "花开有时" },
  { name: "顾清", seed: "guqing", initial: "G", desc: "清心寡欲" },
  { name: "海鸥", seed: "haiou", initial: "H", desc: "飞向远方" },
  { name: "纪南", seed: "jinan", initial: "J", desc: "南风知我意" },
  { name: "柯蓝", seed: "kelan", initial: "K", desc: "蓝色心情" },
];

const groups = computed(() => {
  const map = new Map<string, Contact[]>();
  for (const p of people) {
    // Only real A–Z initials become groups; nothing falls into a「#」bucket.
    const letter = /^[A-Za-z]$/.test(p.initial) ? p.initial.toUpperCase() : "";
    if (!letter) continue;
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
      <v-list class="contacts-list" lines="one">
        <v-list-item v-for="q in quick" :key="q.name" :title="q.name" link>
          <template #prepend>
            <v-avatar :color="q.color" variant="tonal" size="44" rounded="lg">
              <v-icon :icon="q.icon" :color="q.color" />
            </v-avatar>
          </template>
        </v-list-item>

        <!-- ✦ Agents — 置顶分组，展示 WebUI 创建的 Agent -->
        <v-list-subheader>✦ Agents</v-list-subheader>
        <v-list-item
          v-for="a in agents"
          :key="a.name"
          :title="a.name"
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
  padding-top: 4px;
}
/* Even, comfortable rhythm between contact rows and their A–Z headers. */
.contacts-list :deep(.v-list-item) {
  margin-bottom: 6px;
}
.contacts-list :deep(.v-list-item:last-child) {
  margin-bottom: 0;
}
.contacts-list :deep(.v-list-subheader) {
  margin-top: 8px;
}
</style>
