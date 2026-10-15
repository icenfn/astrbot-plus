<script setup lang="ts">
import { computed, ref } from "vue";
import AstrbotAvatar from "@/components/AstrbotAvatar.vue";
import { useHomeTabs } from "@/composables/useHomeTabs";

/**
 * ContactsView — the 联系人 pane (embedded in HomeLayout).
 *
 * Grouping no longer follows pinyin initials (A–Z); instead the list is split
 * into two fixed groups: 「✨ 智能体」(the AstrBot agents) and 「👥 好友」(people).
 * Group titles stick to the top of the scroll area so they stay visible under the
 * application bar while scrolling. The「群聊」entry was removed, and the search box
 * is toggled from the application bar's right-side search button.
 */

interface Contact {
  name: string;
  seed: string;
  desc?: string;
}

const { searchOpen } = useHomeTabs();
const keyword = ref("");

// Agents (bots created in the AstrBot WebUI) form the「智能体」group.
const agents: Contact[] = [
  { name: "阿斯特", seed: "astra-agent", desc: "AstrBot Agent" },
  { name: "Bot 小助手", seed: "bot-agent", desc: "AstrBot Agent" },
  { name: "写作助手", seed: "writer-agent", desc: "AstrBot Agent" },
];

// People form the「好友」group.
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

function matches(c: Contact): boolean {
  const k = keyword.value.trim().toLowerCase();
  if (!k) return true;
  return (
    c.name.toLowerCase().includes(k) ||
    (c.desc ?? "").toLowerCase().includes(k)
  );
}

const filteredAgents = computed(() => agents.filter(matches));
const filteredPeople = computed(() => people.filter(matches));
</script>

<template>
  <div class="contacts">
    <div v-if="searchOpen" class="contacts-search">
      <v-text-field
        v-model="keyword"
        density="comfortable"
        variant="solo-filled"
        flat
        hide-details
        clearable
        prepend-inner-icon="mdi-magnify"
        placeholder="搜索联系人"
        class="contacts-search-field"
      />
    </div>

    <div class="contacts-scroll">
      <v-list class="contacts-list" lines="two">
        <v-list-item title="新的朋友" link>
          <template #prepend>
            <v-avatar color="warning" size="44" rounded="lg">
              <v-icon icon="mdi-account-plus" color="white" />
            </v-avatar>
          </template>
        </v-list-item>

        <template v-if="filteredAgents.length">
          <v-list-subheader class="group-head">✨ 智能体</v-list-subheader>
          <v-list-item
            v-for="a in filteredAgents"
            :key="a.name"
            :title="a.name"
            :subtitle="a.desc"
            link
          >
            <template #prepend>
              <AstrbotAvatar :name="a.name" :seed="a.seed" :size="44" />
            </template>
          </v-list-item>
        </template>

        <template v-if="filteredPeople.length">
          <v-list-subheader class="group-head">👥 好友</v-list-subheader>
          <v-list-item
            v-for="c in filteredPeople"
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
  /* Match the 消息 list background so all three home panes share one colour. */
  background: rgb(var(--v-theme-surface));
}
.contacts-search {
  flex: 0 0 auto;
  padding: 8px 12px 4px;
}
.contacts-search-field :deep(.v-field) {
  border-radius: 10px;
}
.contacts-search-field :deep(.v-field__input) {
  min-height: 40px;
  padding-top: 0;
  padding-bottom: 0;
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
/* Sticky group titles: pin to the top of the scroll area, under the app bar. */
.contacts-list :deep(.group-head) {
  position: sticky;
  top: 0;
  z-index: 2;
  background: rgb(var(--v-theme-surface));
}
</style>
