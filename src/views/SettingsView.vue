<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useSettingsStore, type ThemeMode } from "@/stores/settings";
import { usePlatform } from "@/composables/usePlatform";
import { useWindow } from "@/composables/useWindow";

/**
 * SettingsView — the 设置 page.
 *
 * Settings are rendered as plain text/divider/list sections (no cards): each row
 * is a `v-list-item` with its title/subtitle on the left and its control
 * (`v-switch` / `v-select`) on the right. The 连接 section no longer carries a
 * manual connect button — configuring/reconfiguring the endpoint goes through the
 * standalone 向导 page via 「重新配置」.
 */
const router = useRouter();
const settings = useSettingsStore();
const { connected, connectionState, socketMode } = storeToRefs(settings);
const { isTauri } = usePlatform();
const { setAutoStart } = useWindow();

const themes: { title: string; value: ThemeMode; icon: string }[] = [
  { title: "跟随系统", value: "system", icon: "mdi-theme-light-dark" },
  { title: "深色", value: "telegramDark", icon: "mdi-weather-night" },
  { title: "浅色", value: "telegramLight", icon: "mdi-white-balance-sunny" },
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

const serverAddress = computed(() => settings.settings.socketUrl.trim() || "未配置");

function openWizard(): void {
  void router.push("/wizard");
}

async function onAutoStart(value: boolean): Promise<void> {
  settings.settings.autoStart = value;
  if (canAutoStart.value) await setAutoStart(value);
}
</script>

<template>
  <div class="settings-page">
    <div class="inner">
      <!-- 连接 -->
      <section class="section">
        <div class="section-title">连接</div>
        <v-list class="rows" density="comfortable">
          <v-list-item :subtitle="serverAddress" title="插件服务器地址">
            <template #append>
              <v-btn
                color="primary"
                variant="text"
                size="small"
                @click="openWizard"
              >
                重新配置
              </v-btn>
            </template>
          </v-list-item>
          <v-list-item title="连接状态">
            <template #append>
              <v-chip :color="statusColor" size="small" variant="tonal">
                {{ statusText }} · {{ modeLabel }}
              </v-chip>
            </template>
          </v-list-item>
        </v-list>
      </section>

      <!-- 外观 -->
      <section class="section">
        <div class="section-title">外观</div>
        <v-list class="rows" density="comfortable">
          <v-list-item title="主题">
            <template #append>
              <v-select
                v-model="settings.settings.theme"
                :items="themes"
                item-title="title"
                item-value="value"
                density="compact"
                variant="solo-filled"
                flat
                hide-details
                class="row-select"
              />
            </template>
          </v-list-item>
        </v-list>
      </section>

      <!-- 通知 -->
      <section class="section">
        <div class="section-title">通知</div>
        <v-list class="rows" density="comfortable">
          <v-list-item
            title="启用消息通知"
            subtitle="收到新消息时推送系统通知"
          >
            <template #append>
              <v-switch
                v-model="settings.settings.notifyEnabled"
                color="primary"
                density="compact"
                hide-details
                class="row-switch"
              />
            </template>
          </v-list-item>
          <v-list-item
            title="仅后台提醒"
            subtitle="仅在窗口不在前台时通知"
            :disabled="!settings.settings.notifyEnabled"
          >
            <template #append>
              <v-switch
                v-model="settings.settings.notifyOnlyBackground"
                color="primary"
                density="compact"
                hide-details
                class="row-switch"
                :disabled="!settings.settings.notifyEnabled"
              />
            </template>
          </v-list-item>
        </v-list>
      </section>

      <!-- 后台运行（移动端） -->
      <section class="section">
        <div class="section-title">后台运行</div>
        <v-list class="rows" density="comfortable">
          <v-list-item
            title="允许后台运行"
            subtitle="保持连接并接收消息（将申请忽略电池优化权限）"
          >
            <template #append>
              <v-switch
                v-model="settings.settings.backgroundRun"
                color="primary"
                density="compact"
                hide-details
                class="row-switch"
              />
            </template>
          </v-list-item>
        </v-list>
      </section>

      <!-- 启动与窗口（桌面端） -->
      <section v-if="isTauri" class="section">
        <div class="section-title">启动与窗口</div>
        <v-list class="rows" density="comfortable">
          <v-list-item title="开机自启动">
            <template #append>
              <v-switch
                :model-value="settings.settings.autoStart"
                color="primary"
                density="compact"
                hide-details
                class="row-switch"
                @update:model-value="onAutoStart($event as boolean)"
              />
            </template>
          </v-list-item>
          <v-list-item title="最小化到托盘">
            <template #append>
              <v-switch
                v-model="settings.settings.minimizeToTray"
                color="primary"
                density="compact"
                hide-details
                class="row-switch"
              />
            </template>
          </v-list-item>
          <v-list-item title="关闭时最小化到托盘">
            <template #append>
              <v-switch
                v-model="settings.settings.closeToTray"
                color="primary"
                density="compact"
                hide-details
                class="row-switch"
              />
            </template>
          </v-list-item>
        </v-list>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 0 20px;
}
.inner {
  max-width: 640px;
  margin: 0 auto;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
}
.section {
  margin-top: 16px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: rgba(var(--v-theme-on-surface), 0.6);
  padding: 4px 4px 8px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.rows {
  background: transparent;
  padding: 0;
}
.rows :deep(.v-list-item) {
  padding-inline: 4px;
}
.rows :deep(.v-list-item + .v-list-item) {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.row-switch {
  flex: 0 0 auto;
  margin: 0;
}
.row-select {
  flex: 0 0 auto;
  width: 148px;
  margin: 0;
}
.row-select :deep(.v-field) {
  border-radius: 8px;
}
</style>
