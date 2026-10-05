<script setup lang="ts">
import { onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/stores/settings";
import { useChatStore } from "@/stores/chat";
import { notify } from "@/composables/useNotify";
import { useWindow } from "@/composables/useWindow";
import { isTauri } from "@/api/client";

const settings = useSettingsStore();
const chat = useChatStore();
const { connecting, lastError, connected, botIds, providers } = storeToRefs(settings);
const { wsStatus } = storeToRefs(chat);
const { setAutoStart, isAutoStartEnabled } = useWindow();

const revealKey = ref(false);
const autostartAvailable = ref(false);

onMounted(async () => {
  autostartAvailable.value = isTauri() && (await isAutoStartEnabled()) !== undefined;
});

async function reconnect() {
  const ok = await settings.testConnection();
  if (ok) {
    chat.connectWs();
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

    <v-alert v-if="lastError" type="error" variant="tonal" density="compact" class="mb-4" :text="lastError" />

    <!-- Connection -->
    <v-card class="section" variant="outlined">
      <v-card-item>
        <template #prepend><v-icon icon="mdi-server-network" color="primary" /></template>
        <v-card-title>连接</v-card-title>
        <v-card-subtitle>AstrBot 服务地址与 API Key</v-card-subtitle>
      </v-card-item>
      <v-card-text class="d-flex flex-column ga-4 pt-2">
        <v-text-field
          v-model="settings.settings.baseUrl"
          label="服务器地址"
          placeholder="http://localhost:6185"
          prepend-inner-icon="mdi-web"
          hint="AstrBot 服务根地址，用于列出 AstrBot+ 会话列表"
          persistent-hint
        />
        <v-text-field
          v-model="settings.settings.apiKey"
          label="API Key"
          placeholder="abk_..."
          prepend-inner-icon="mdi-key-variant"
          :type="revealKey ? 'text' : 'password'"
          :append-inner-icon="revealKey ? 'mdi-eye-off' : 'mdi-eye'"
          @click:append-inner="revealKey = !revealKey"
        />
        <v-text-field
          v-model="settings.settings.wsUrl"
          label="WebSocket 地址"
          placeholder="ws://localhost:6199/ws"
          prepend-inner-icon="mdi-transit-connection-variant"
          hint="由 astrbot-plugin-plus 插件提供，聊天消息实时收发均经此 WebSocket"
          persistent-hint
        />
        <v-text-field
          v-model="settings.settings.wsToken"
          label="WebSocket 令牌（可选）"
          placeholder="留空表示不校验"
          prepend-inner-icon="mdi-shield-key-outline"
        />
        <div class="d-flex ga-2">
          <v-btn color="primary" :loading="connecting" prepend-icon="mdi-connection" @click="reconnect">
            测试连接
          </v-btn>
          <v-chip
            :color="wsStatus === 'open' ? 'success' : 'warning'"
            variant="tonal"
            size="small"
            class="align-self-center"
          >
            WS：{{ wsStatus === "open" ? "已连接" : wsStatus === "connecting" ? "连接中" : wsStatus === "closed" ? "已断开" : "未连接" }}
          </v-chip>
        </div>
        <div v-if="botIds.length" class="text-caption text-medium-emphasis">
          已发现的机器人：{{ botIds.join("、") }} · 提供商 {{ providers.length }} 个
        </div>
      </v-card-text>
    </v-card>

    <!-- Notifications -->
    <v-card class="section" variant="outlined">
      <v-card-item>
        <template #prepend><v-icon icon="mdi-bell-ring" color="primary" /></template>
        <v-card-title>系统通知</v-card-title>
        <v-card-subtitle>收到回复时调用系统通知</v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <v-switch
          v-model="settings.settings.notifyEnabled"
          label="启用系统通知"
          color="primary"
          hide-details
          inset
        />
        <v-switch
          v-model="settings.settings.notifyOnlyBackground"
          label="仅在后台 / 窗口未聚焦时通知"
          color="primary"
          hide-details
          inset
          class="mt-2"
        />
        <v-btn class="mt-3" variant="tonal" prepend-icon="mdi-bell-outline" @click="demoNotify">
          发送测试通知
        </v-btn>
      </v-card-text>
    </v-card>

    <!-- Background running -->
    <v-card class="section" variant="outlined">
      <v-card-item>
        <template #prepend><v-icon icon="mdi-power" color="primary" /></template>
        <v-card-title>后台运行</v-card-title>
        <v-card-subtitle>关闭窗口后驻留系统托盘</v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <v-switch
          v-model="settings.settings.closeToTray"
          label="关闭窗口时最小化到托盘（不退出）"
          color="primary"
          hide-details
          inset
        />
        <v-switch
          v-model="settings.settings.minimizeToTray"
          label="最小化时隐藏到托盘"
          color="primary"
          hide-details
          inset
          class="mt-2"
        />
        <v-switch
          v-model="settings.settings.autoStart"
          label="开机自动启动"
          color="primary"
          hide-details
          inset
          class="mt-2"
          @update:model-value="toggleAutoStart"
        />
        <p v-if="!isTauri()" class="text-caption text-medium-emphasis mt-2">
          以上托盘 / 自启功能仅在打包后的桌面应用（Tauri）中生效。
        </p>
      </v-card-text>
    </v-card>

    <!-- Appearance -->
    <v-card class="section" variant="outlined">
      <v-card-item>
        <template #prepend><v-icon icon="mdi-palette" color="primary" /></template>
        <v-card-title>外观</v-card-title>
        <v-card-subtitle>主题与界面偏好</v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <v-btn-toggle v-model="settings.settings.theme" color="primary" mandatory variant="tonal">
          <v-btn value="system" prepend-icon="mdi-theme-light-dark">跟随系统</v-btn>
          <v-btn value="astrbotDark" prepend-icon="mdi-weather-night">深色</v-btn>
          <v-btn value="astrbotLight" prepend-icon="mdi-weather-sunny">浅色</v-btn>
        </v-btn-toggle>
      </v-card-text>
    </v-card>

    <v-card class="section" variant="outlined">
      <v-card-item>
        <template #prepend><v-icon icon="mdi-information-outline" color="primary" /></template>
        <v-card-title>AstrBot+</v-card-title>
        <v-card-subtitle>开源桌面客户端 · v0.2.0</v-card-subtitle>
      </v-card-item>
      <v-card-text class="text-caption text-medium-emphasis">
        基于 Tauri + Vue 3 + Vuetify 4 + Pinia + VueUse 构建。
        会话列表经 AstrBot HTTP OpenAPI 获取，聊天消息通过 astrbot-plugin-plus 提供的
        WebSocket 实时收发。图标参考 AstrBot 官方 favicon 二次创作。
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
  padding: 20px 24px 40px;
  max-width: 780px;
}
.head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.title {
  font-size: 20px;
  font-weight: 700;
}
.section {
  margin-bottom: 16px;
  border-radius: 14px;
}
</style>
