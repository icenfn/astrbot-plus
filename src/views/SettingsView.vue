<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useSettingsStore, type ThemeMode } from "@/stores/settings";
import { useChatStore } from "@/stores/chat";
import { usePlatform } from "@/composables/usePlatform";
import { useWindow } from "@/composables/useWindow";

const settings = useSettingsStore();
const chat = useChatStore();
const { connected, connecting, lastError } = storeToRefs(settings);
const { agents } = storeToRefs(chat);
const { isTauri } = usePlatform();
const { setAutoStart } = useWindow();

const themes: { title: string; value: ThemeMode }[] = [
  { title: "跟随系统", value: "system" },
  { title: "深色", value: "astrbotDark" },
  { title: "浅色", value: "astrbotLight" },
];

const canAutoStart = computed(() => isTauri);

async function onConnect() {
  const ok = await settings.connect();
  if (ok) await chat.loadContacts();
}

function onDisconnect() {
  settings.disconnect();
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

      <!-- 连接 -->
      <v-card class="card" variant="flat">
        <v-card-title class="card-title">连接</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="settings.settings.socketUrl"
            label="插件服务器地址"
            placeholder="例如 192.168.1.10:6199"
            density="compact"
            variant="solo-filled"
            hide-details="auto"
            class="mb-3"
          />
          <v-text-field
            v-model="settings.settings.accessKey"
            label="访问密钥（可选）"
            type="password"
            density="compact"
            variant="solo-filled"
            hide-details="auto"
            class="mb-3"
          />
          <v-text-field
            v-model.number="settings.settings.pollIntervalSec"
            label="列表刷新间隔（秒）"
            type="number"
            min="5"
            density="compact"
            variant="solo-filled"
            hide-details="auto"
            class="mb-3"
          />
          <div class="row">
            <v-btn
              color="primary"
              :loading="connecting"
              @click="onConnect"
            >
              连接
            </v-btn>
            <v-btn v-if="connected" variant="tonal" @click="onDisconnect">断开</v-btn>
            <v-chip :color="connected ? 'success' : 'grey'" size="small" variant="tonal">
              {{ connected ? "已连接" : "未连接" }}
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
          <div v-if="connected" class="text-caption text-medium-emphasis mt-3">
            已同步：{{ agents.length }} 个 Agent
          </div>
        </v-card-text>
      </v-card>

      <!-- 外观 -->
      <v-card class="card" variant="flat">
        <v-card-title class="card-title">外观</v-card-title>
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
        <v-card-title class="card-title">通知</v-card-title>
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

      <!-- 启动与窗口（桌面端） -->
      <v-card v-if="isTauri" class="card" variant="flat">
        <v-card-title class="card-title">启动与窗口</v-card-title>
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

      <!-- 关于 -->
      <v-card class="card" variant="flat">
        <v-card-title class="card-title">关于</v-card-title>
        <v-card-text class="text-medium-emphasis">
          <p>AstrBot+ 客户端 · v0.3.2</p>
          <p class="text-caption">
            Agent 列表与对话通过配套插件 <code>astrbot-plugin-plus</code> 的 Socket.io 服务端提供。
          </p>
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
}
.card-title {
  font-size: 15px;
  font-weight: 600;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
