<script setup lang="ts">
import AstrbotAvatar from "@/components/AstrbotAvatar.vue";

// UI-only page. The 设置 entry lives here; the other rows are placeholders and
// intentionally have no behaviour yet. The「外观」and「消息通知」rows were removed
// (appearance + notification settings live in 设置), and「关于 AstrBot+」now
// opens the dedicated about page.

interface MenuItem {
  title: string;
  icon: string;
  to?: string;
}

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
          <AstrbotAvatar name="AstrBot 用户" seed="astrbot-plus-me" :size="64" />
          <div class="profile-meta">
            <div class="profile-name">AstrBot 用户</div>
            <div class="profile-id">ID: astrbot_plus</div>
          </div>
          <v-icon icon="mdi-qrcode" class="profile-qr" />
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
}
.profile-id {
  margin-top: 2px;
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.profile-qr {
  color: rgba(var(--v-theme-on-surface), 0.55);
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
