<script setup lang="ts">
import AstrbotAvatar from "@/components/AstrbotAvatar.vue";

/**
 * ContactsView — the 联系人 pane (embedded in HomeLayout).
 *
 * The list is split into two fixed groups: 「🤖 智能体」(the AstrBot agents) and
 * 「👥 好友」(people). Group titles stick to the top of the scroll area so they stay
 * visible directly under the application bar while scrolling.
 *
 * The per-contact subtitle (desc) and the search field — previously toggled from the
 * application bar's right-side search button — were removed, and the pane's right-hand
 * scrollbar is hidden while the content stays scrollable.
 */

interface Contact {
  name: string;
  seed: string;
}

// Agents (bots created in the AstrBot WebUI) form the「智能体」group.
const agents: Contact[] = [
  { name: "阿斯特", seed: "astra-agent" },
  { name: "Bot 小助手", seed: "bot-agent" },
  { name: "写作助手", seed: "writer-agent" },
];

// People form the「好友」group.
const people: Contact[] = [
  { name: "白露", seed: "bailu" },
  { name: "陈默", seed: "chenmo" },
  { name: "丁一", seed: "dingyi" },
  { name: "风信子", seed: "fengxinzi" },
  { name: "顾清", seed: "guqing" },
  { name: "海鸥", seed: "haiou" },
  { name: "纪南", seed: "jinan" },
  { name: "柯蓝", seed: "kelan" },
];
</script>

<template>
  <div class="contacts">
    <div class="contacts-scroll">
      <v-list class="contacts-list">
        <v-list-item title="新的朋友" link>
          <template #prepend>
            <v-avatar color="warning" size="44" rounded="lg">
              <v-icon icon="mdi-account-plus" color="white" />
            </v-avatar>
          </template>
        </v-list-item>

        <template v-if="agents.length">
          <v-list-subheader class="group-head">🤖 智能体</v-list-subheader>
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
        </template>

        <template v-if="people.length">
          <v-list-subheader class="group-head">👥 好友</v-list-subheader>
          <v-list-item
            v-for="c in people"
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
  /* Match the 消息 list background so all three home panes share one colour. */
  background: rgb(var(--v-theme-surface));
}
.contacts-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  /* Hide the right-hand scrollbar while keeping the content scrollable. */
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.contacts-scroll::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
.contacts-list {
  background: transparent;
  padding-top: 4px;
  /* Vuetify's .v-list has `overflow: auto`, which would make the list itself the
     nearest scrollport and break `position: sticky` on the group titles. Let the
     pane (`.contacts-scroll`) own the scrollport instead. */
  overflow: visible;
}
/* Sticky group titles: pin to the top of the scroll area, under the app bar. */
.contacts-list :deep(.group-head) {
  position: sticky;
  top: 0;
  z-index: 2;
  background: rgb(var(--v-theme-surface));
}
</style>
