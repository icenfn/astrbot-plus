<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useSettingsStore, type ThemeMode } from "@/stores/settings";
import { useChatStore } from "@/stores/chat";
import { usePlatform } from "@/composables/usePlatform";
import { useWindow } from "@/composables/useWindow";

const settings = useSettingsStore();
const chat = useChatStore();
const { connected, connecting, lastError, connectionState, socketMode } =
  storeToRefs(settings);
const { isTauri } = usePlatform();
const { setAutoStart } = useWindow();

const themes: { title: string; value: ThemeMode }[] = [
  { title: "跟随系统", value: "system" },
  { title: "深色", value: "telegramDark" },
  { title: "浅色", value: "telegramLight" },
];

const canAutoStart = computed(() => isTauri);

// Connection status chip: state + the active Socket.io transport (websocket /
// long-polling), so the user can see how the connection is carrying traffic.
const statusColor = computed(() => {
  switch (connectionState.value) {
    case "connected":
      return "success";
    case "connecting":
    case "reconnecting":
      return "warning";
    default:
      return "grey";
  }
});

const statusText = computed(() => {
  switch (connectionState.value) {
    case "connected":
      return "已连接";
    case "connecting":
      return "连接中";
    case "reconnecting":
      return "重连中";
    case "disconnected":
      return "已断开";
    default:
      return "未连接";
  }
});

const modeLabel = computed(() =>
  socketMode.value === "websocket"
    ? "socket.io · websocket"
    : socketMode.value === "polling"
      ? "socket.io · polling"
      : "socket.io · —",
);

async function onConnect() {
  const ok = await settings.connect();
  if (ok) await chat.loadContacts();
}

async function onAutoStart(value: boolean) {
  settings.settings.autoStart = value;
  if (canAutoStart.value) await setAutoStart(value);
}
</script>

<template>
  <div class="settings-page">
    <div class="inner">
      <header class="top">
        <h1 class="text-h5">设置</h1>
      </header>

      <!-- 连接：仅包含编辑框、连接按钮、连接状态 v-chip（显示 socket.io 连接模式） -->
      <v-card class="card" variant="flat">
        <v-card-title class="card-title">
          <v-icon icon="mdi-lan-connect" size="18" class="mr-2" />连接
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="settings.settings.socketUrl"
            label="插件服务器地址"
            placeholder="例如 192.168.1.10:6199 或 ws://192.168.1.10:6199"
            density="compact"
            variant="solo-filled"
            hide-details="auto"
            class="mb-3"
          />
          <div class="row">
            <v-btn color="primary" :loading="connecting" @click="onConnect">
              连接
            </v-btn>
            <v-chip :color="statusColor" size="small" variant="tonal">
              {{ statusText }} · {{ modeLabel }}
            </v-chip>
          </div>
          <v-alert
            v-if="lastError"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-3"
            :text="lastError"
          />
        </v-card-text>
      </v-card>

      <!-- 外观 -->
      <v-card class="card" variant="flat">
        <v-card-title class="card-title">
          <v-icon icon="mdi-palette-outline" size="18" class="mr-2" />外观
        </v-card-title>
        <v-card-text>
          <v-select
            v-model="settings.settings.theme"
            :items="themes"
            item-title="title"
            item-value="value"
            label="主题"
            density="compact"
            variant="solo-filled"
            hide-details
          />
        </v-card-text>
      </v-card>

      <!-- 通知 -->
      <v-card class="card" variant="flat">
        <v-card-title class="card-title">
          <v-icon icon="mdi-bell-outline" size="18" class="mr-2" />通知
        </v-card-title>
        <v-card-text>
          <v-switch
            v-model="settings.settings.notifyEnabled"
            label="启用消息通知"
            color="primary"
            density="compact"
            hide-details
          />
          <v-switch
            v-model="settings.settings.notifyOnlyBackground"
            label="仅在窗口不在前台时通知"
            color="primary"
            density="compact"
            hide-details
            :disabled="!settings.settings.notifyEnabled"
          />
        </v-card-text>
      </v-card>

      <!-- 后台运行（移动端）：申请系统后台运行权限 -->
      <v-card class="card" variant="flat">
        <v-card-title class="card-title">
          <v-icon icon="mdi-cellphone-arrow-down" size="18" class="mr-2" />后台运行
        </v-card-title>
        <v-card-text>
          <v-switch
            v-model="settings.settings.backgroundRun"
            label="允许后台运行（保持连接并接收消息）"
            color="primary"
            density="compact"
            hide-details
          />
          <div class="text-caption text-medium-emphasis mt-2">
            开启后将向系统申请后台运行 / 忽略电池优化权限，以在后台持续保持 Socket.io 连接与断线重连。
          </div>
        </v-card-text>
      </v-card>

      <!-- 启动与窗口（桌面端） -->
      <v-card v-if="isTauri" class="card" variant="flat">
        <v-card-title class="card-title">
          <v-icon icon="mdi-window-restore" size="18" class="mr-2" />启动与窗口
        </v-card-title>
        <v-card-text>
          <v-switch
            :model-value="settings.settings.autoStart"
            label="开机自启动"
            color="primary"
            density="compact"
            hide-details
            @update:model-value="onAutoStart($event as boolean)"
          />
          <v-switch
            v-model="settings.settings.minimizeToTray"
            label="最小化到托盘"
            color="primary"
            density="compact"
            hide-details
          />
          <v-switch
            v-model="settings.settings.closeToTray"
            label="关闭时最小化到托盘"
            color="primary"
            density="compact"
            hide-details
          />
        </v-card-text>
      </v-card>

    </div>
  </div>
</template>

<style scoped>
.settings-page {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 20px;
}
.inner {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.top {
  padding: 4px 2px 2px;
}
.card {
  border: 1px solid rgba(128, 150, 170, 0.16);
  background: rgb(var(--v-theme-surface));
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
