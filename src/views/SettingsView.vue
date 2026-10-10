<script setup lang="ts">
import { ref } from "vue";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/stores/settings";
import { useChatStore } from "@/stores/chat";
import { notify } from "@/composables/useNotify";
import { useWindow } from "@/composables/useWindow";
import { isTauri } from "@/api/client";

const settings = useSettingsStore();
const chat = useChatStore();
const { connecting, lastError, connected } = storeToRefs(settings);
const { friendCount, dialogCount } = storeToRefs(chat);
const { setAutoStart } = useWindow();

const revealKey = ref(false);

async function reconnect() {
  const ok = await settings.connect();
  if (ok) {
    await chat.loadContacts();
    chat.startPolling(settings.settings.pollIntervalSec * 1000);
    notify({ title: "AstrBot+", body: "连接成功" });
  }
}

async function demoNotify() {
  await notify({ title: "AstrBot+", body: "这是一条系统通知示例 ✓" });
}

async function toggleAutoStart(value: boolean | null) {
  const enabled = value === true;
  settings.settings.autoStart = enabled;
  await setAutoStart(enabled);
}
</script>

<template>
  <div class="settings-view">
    <header class="head">
      <h2 class="title">设置</h2>
      <v-chip :color="connected ? 'success' : 'error'" variant="tonal" size="small">
        <v-icon start :icon="connected ? 'mdi-check-circle' : 'mdi-alert-circle'" size="14" />
        {{ connected ? "已连接" : "未连接" }}
      </v-chip>
    </header>

    <v-alert v-if="lastError" type="error" variant="tonal" density="compact" class="mb-3" :text="lastError" />

    <!-- Connection -->
    <v-card class="section" variant="outlined">
      <v-card-item class="section-head">
        <template #prepend><v-icon icon="mdi-server-network" color="primary" /></template>
        <v-card-title>连接</v-card-title>
        <v-card-subtitle>AstrBot+ 插件地址与访问密钥（Socket.io）</v-card-subtitle>
      </v-card-item>
      <v-card-text class="d-flex flex-column ga-3 pt-1">
        <v-text-field
          v-model="settings.settings.socketUrl"
          label="插件服务器地址"
          placeholder="http://localhost:6199"
          prepend-inner-icon="mdi-web"
          density="compact"
        />
        <v-text-field
          v-model="settings.settings.accessKey"
          label="访问密钥（API Key）"
          placeholder="与插件 access_key 一致"
          prepend-inner-icon="mdi-key-variant"
          :type="revealKey ? 'text' : 'password'"
          :append-inner-icon="revealKey ? 'mdi-eye-off' : 'mdi-eye'"
          density="compact"
          @click:append-inner="revealKey = !revealKey"
        />
        <div class="d-flex ga-2 align-center">
          <v-btn color="primary" size="small" :loading="connecting" prepend-icon="mdi-connection" @click="reconnect">
            测试连接
          </v-btn>
          <v-btn size="small" variant="text" prepend-icon="mdi-close" @click="settings.disconnect()">
            断开
          </v-btn>
        </div>
        <div v-if="connected" class="text-caption text-medium-emphasis">
          已同步：{{ friendCount }} 个机器人 · {{ dialogCount }} 段对话
        </div>
      </v-card-text>
    </v-card>

    <!-- Notifications -->
    <v-card class="section" variant="outlined">
      <v-card-item class="section-head">
        <template #prepend><v-icon icon="mdi-bell-ring" color="primary" /></template>
        <v-card-title>系统通知</v-card-title>
        <v-card-subtitle>收到回复时调用系统通知</v-card-subtitle>
      </v-card-item>
      <v-card-text class="pt-1">
        <v-switch
          v-model="settings.settings.notifyEnabled"
          label="启用系统通知"
          color="primary"
          density="compact"
          hide-details
          inset
        />
        <v-switch
          v-model="settings.settings.notifyOnlyBackground"
          label="仅在后台 / 窗口未聚焦时通知"
          color="primary"
          density="compact"
          hide-details
          inset
        />
        <v-btn class="mt-3" size="small" variant="tonal" prepend-icon="mdi-bell-outline" @click="demoNotify">
          发送测试通知
        </v-btn>
      </v-card-text>
    </v-card>

    <!-- Background running -->
    <v-card class="section" variant="outlined">
      <v-card-item class="section-head">
        <template #prepend><v-icon icon="mdi-power" color="primary" /></template>
        <v-card-title>后台运行</v-card-title>
        <v-card-subtitle>关闭窗口后驻留系统托盘</v-card-subtitle>
      </v-card-item>
      <v-card-text class="pt-1">
        <v-switch
          v-model="settings.settings.closeToTray"
          label="关闭窗口时最小化到托盘（不退出）"
          color="primary"
          density="compact"
          hide-details
          inset
        />
        <v-switch
          v-model="settings.settings.minimizeToTray"
          label="最小化时隐藏到托盘"
          color="primary"
          density="compact"
          hide-details
          inset
        />
        <v-switch
          v-model="settings.settings.autoStart"
          label="开机自动启动"
          color="primary"
          density="compact"
          hide-details
          inset
          @update:model-value="toggleAutoStart"
        />
        <p v-if="!isTauri()" class="text-caption text-medium-emphasis mt-1">
          以上托盘 / 自启功能仅在打包后的桌面应用（Tauri）中生效。
        </p>
      </v-card-text>
    </v-card>

    <!-- Appearance -->
    <v-card class="section" variant="outlined">
      <v-card-item class="section-head">
        <template #prepend><v-icon icon="mdi-palette" color="primary" /></template>
        <v-card-title>外观</v-card-title>
        <v-card-subtitle>主题与界面偏好</v-card-subtitle>
      </v-card-item>
      <v-card-text class="pt-1">
        <v-btn-toggle v-model="settings.settings.theme" color="primary" mandatory variant="outlined" density="comfortable">
          <v-btn value="system" prepend-icon="mdi-theme-light-dark">跟随系统</v-btn>
          <v-btn value="astrbotDark" prepend-icon="mdi-weather-night">深色</v-btn>
          <v-btn value="astrbotLight" prepend-icon="mdi-weather-sunny">浅色</v-btn>
        </v-btn-toggle>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.settings-view {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
  padding: 16px 20px 28px;
  max-width: 780px;
}
.head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.title {
  font-size: 20px;
  font-weight: 700;
}
.section {
  margin-bottom: 12px;
  border-radius: 14px;
}
.section-head {
  padding-bottom: 4px;
}
.section-head :deep(.v-card-subtitle) {
  opacity: 0.6;
}
</style>
