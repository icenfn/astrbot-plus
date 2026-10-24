<script setup lang="ts">
import { computed } from "vue";
import { useSettingsStore } from "@/stores/settings";
import AstrbotAvatar from "@/components/AstrbotAvatar.vue";

/** 「我的」页：展示服务端下发的用户基础信息。 */
interface MenuItem {
  title: string;
  icon: string;
  to?: string;
}

const settings = useSettingsStore();

const user = computed(() => settings.settings.currentUser);
const displayName = computed(
  () => user.value?.username || settings.settings.email || "AstrBot 用户",
);
const avatar = computed(() => user.value?.avatar || "");
const apId = computed(() => user.value?.ap_id || "—");
const email = computed(() => user.value?.email || settings.settings.email || "");

const menu: MenuItem[] = [
  { title: "设置", icon: "mdi-cog-outline", to: "/settings" },
  { title: "账号与安全", icon: "mdi-shield-account-outline" },
  { title: "关于 AstrBot+", icon: "mdi-information-outline", to: "/about" },
];
</script>

<template>
  <div class="mine">
    <div class="mine-scroll chat-scroll">
      <v-card class="profile" variant="flat" rounded="lg">
        <div class="profile-row">
          <AstrbotAvatar :name="displayName" :src="avatar" type="user" :size="64" />
          <div class="profile-meta">
            <div class="profile-name">{{ displayName }}</div>
            <div v-if="email" class="profile-email">{{ email }}</div>
            <div class="profile-id">
              <span class="label">ap_id</span>
              <span class="mono">{{ apId }}</span>
            </div>
          </div>
        </div>
      </v-card>

      <v-card class="menu" variant="flat" rounded="lg">
        <v-list class="menu-list">
          <v-list-item
            v-for="item in menu"
            :key="item.title"
            :title="item.title"
            :prepend-icon="item.icon"
            v-bind="item.to ? { to: item.to } : {}"
            link
          >
            <template #append>
              <v-icon icon="mdi-chevron-right" size="20" />
            </template>
          </v-list-item>
        </v-list>
      </v-card>

      <p class="foot">AstrBot+ · 由 AstrBot 驱动</p>
    </div>
  </div>
</template>

<style scoped>
.mine {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  /* Unify with the 消息 list surface (was --v-theme-background). */
  background: rgb(var(--v-theme-surface));
}
.mine-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
}
.profile {
  background: rgb(var(--v-theme-surface));
  padding: 16px;
  margin-bottom: 12px;
}
.profile-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.profile-meta {
  flex: 1 1 auto;
  min-width: 0;
}
.profile-name {
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.profile-email {
  margin-top: 2px;
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.profile-id {
  margin-top: 4px;
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.profile-id .label {
  flex: 0 0 auto;
  opacity: 0.7;
}
.profile-id .mono {
  font-family: ui-monospace, "SFMono-Regular", "Menlo", monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.menu {
  background: rgb(var(--v-theme-surface));
}
.menu-list {
  background: transparent;
}
.foot {
  margin: 16px 0 8px;
  text-align: center;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.45);
}
</style>
