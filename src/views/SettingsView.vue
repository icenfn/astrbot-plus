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
 * Settings are rendered as grouped text/divider/list sections (no cards): each row
 * is a `v-list-item` whose title/subtitle sit on the left and whose control
 * (`v-switch` / `v-select`) sits on the right. Every row carries a subtitle so the
 * effect of each option is clear. The 连接 section has no manual connect button —
 * configuring/reconfiguring the endpoint goes through the standalone 向导 page.
 *
 * The pane owns its scroll (native scrollbar hidden) so it matches the rest of the
 * app's borderless surfaces.
 */
const router = useRouter();
const settings = useSettingsStore();
const { connected, connectionState, socketMode } = storeToRefs(settings);
const { isTauri } = usePlatform();
const { setAutoStart } = useWindow();

const themes: { title: string; value: ThemeMode }[] = [
  { title: "跟随系统", value: "system" },
  { title: "深色", value: "telegramDark" },
  { title: "浅色", value: "telegramLight" },
];

// 通知方式 — HOW/WHEN to be reminded. Mapped onto the single boolean
// `notifyOnlyBackground` so the stored schema is unchanged.
const notifyModes: { title: string; value: "always" | "background" }[] = [
  { title: "始终提醒", value: "always" },
  { title: "仅后台", value: "background" },
];

const notifyMode = computed({
  get: () => (settings.settings.notifyOnlyBackground ? "background" : "always"),
  set: (value) => {
    settings.settings.notifyOnlyBackground = value === "background";
  },
});

const canAutoStart = computed(() => isTauri);

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
    ? "websocket"
    : socketMode.value === "polling"
      ? "polling"
      : "—",
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
        <h2 class="section-title">连接</h2>
        <v-list class="rows" density="comfortable">
          <v-list-item
            title="插件服务器地址"
            :subtitle="serverAddress"
          >
            <template #append>
              <v-btn
                color="primary"
                variant="text"
                size="small"
                class="row-btn"
                @click="openWizard"
              >
                重新配置
              </v-btn>
            </template>
          </v-list-item>
          <v-list-item title="连接状态" subtitle="与插件服务器的实时连接状态">
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
        <h2 class="section-title">外观</h2>
        <v-list class="rows" density="comfortable">
          <v-list-item title="主题" subtitle="跟随系统会随系统的深浅色自动切换">
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
        <h2 class="section-title">通知</h2>
        <v-list class="rows" density="comfortable">
          <v-list-item
            title="消息通知"
            subtitle="收到 Agent 的新消息时推送系统通知"
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
            title="通知方式"
            subtitle="始终提醒，或仅在 App 处于后台时提醒"
            :disabled="!settings.settings.notifyEnabled"
          >
            <template #append>
              <v-select
                v-model="notifyMode"
                :items="notifyModes"
                item-title="title"
                item-value="value"
                density="compact"
                variant="solo-filled"
                flat
                hide-details
                class="row-select"
                :disabled="!settings.settings.notifyEnabled"
              />
            </template>
          </v-list-item>
        </v-list>
      </section>

      <!-- 后台运行 -->
      <section class="section">
        <h2 class="section-title">后台运行</h2>
        <v-list class="rows" density="comfortable">
          <v-list-item
            title="允许后台运行"
            subtitle="App 退到后台时保持连接并接收消息（需要通知与电池优化权限）"
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
        <h2 class="section-title">启动与窗口</h2>
        <v-list class="rows" density="comfortable">
          <v-list-item title="开机自启动" subtitle="登录系统后自动启动 AstrBot+">
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
          <v-list-item title="最小化到托盘" subtitle="点击最小化时隐藏到系统托盘而非任务栏">
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
          <v-list-item title="关闭时最小化到托盘" subtitle="关闭窗口时保持后台运行，而不是退出应用">
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
  min-height: 0;
  overflow-y: auto;
  padding: 4px 0 24px;
  background: rgb(var(--v-theme-surface));
  /* Native scrollbar hidden — the pane scrolls without showing a track. */
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.settings-page::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
.inner {
  max-width: 640px;
  margin: 0 auto;
  /* Generous gutters + no clipping: rows/selects must never be cut off. */
  padding: 0 18px;
  display: flex;
  flex-direction: column;
  overflow: visible;
}
.section {
  margin-top: 20px;
}
.section-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: rgb(var(--v-theme-primary));
  padding: 0 4px 8px;
}
.rows {
  background: transparent;
  padding: 0;
}
.rows :deep(.v-list-item) {
  padding-inline: 4px;
  min-height: 56px;
  /* Let appended controls (switch/select/chip/button) breathe inside the row. */
  overflow: visible;
}
.rows :deep(.v-list-item__append) {
  overflow: visible;
}
.rows :deep(.v-list-item-subtitle) {
  white-space: normal;
  line-height: 1.35;
  opacity: 0.7;
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
  width: 150px;
  max-width: 48%;
  margin: 0;
}
.row-select :deep(.v-field) {
  border-radius: 10px;
}
.row-btn {
  flex: 0 0 auto;
}
</style>
