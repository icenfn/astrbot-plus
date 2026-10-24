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
  { title: "深色", value: "dark" },
  { title: "浅色", value: "light" },
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

const serverAddress = computed(
  () => settings.settings.serverUrl.trim() || "未配置",
);
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
            title="服务器地址"
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
          <v-list-item title="连接状态" subtitle="与服务器的连接状态">
            <template #append>
              <v-chip :color="statusColor" size="small" variant="tonal" rounded="lg">
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
          <v-list-item title="主题" subtitle="跟随系统深浅色切换">
            <template #append>
              <v-select
                v-model="settings.settings.theme"
                :items="themes"
                item-title="title"
                item-value="value"
                variant="solo-filled"
                density="comfortable"
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
            subtitle="收到新消息时推送系统通知"
          >
            <template #append>
              <v-switch
                v-model="settings.settings.notifyEnabled"
                color="primary"
                density="compact"
                hide-details
                inset
                class="row-switch"
              />
            </template>
          </v-list-item>
          <v-list-item
            title="通知方式"
            subtitle="始终提醒，或仅后台提醒"
            :disabled="!settings.settings.notifyEnabled"
          >
            <template #append>
              <v-select
                v-model="notifyMode"
                :items="notifyModes"
                item-title="title"
                item-value="value"
                variant="solo-filled"
                density="comfortable"
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
            subtitle="后台保持连接并接收消息"
          >
            <template #append>
              <v-switch
                v-model="settings.settings.backgroundRun"
                color="primary"
                density="compact"
                hide-details
                inset
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
          <v-list-item title="开机自启动" subtitle="登录系统后自动启动">
            <template #append>
              <v-switch
                :model-value="settings.settings.autoStart"
                color="primary"
                density="compact"
                hide-details
                inset
                class="row-switch"
                @update:model-value="onAutoStart($event as boolean)"
              />
            </template>
          </v-list-item>
          <v-list-item title="最小化到托盘" subtitle="最小化时隐藏到托盘">
            <template #append>
              <v-switch
                v-model="settings.settings.minimizeToTray"
                color="primary"
                density="compact"
                hide-details
                inset
                class="row-switch"
              />
            </template>
          </v-list-item>
          <v-list-item title="关闭时最小化到托盘" subtitle="关闭时保持后台运行">
            <template #append>
              <v-switch
                v-model="settings.settings.closeToTray"
                color="primary"
                density="compact"
                hide-details
                inset
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
/* select 放在**右侧** append 槽内，与 title/subtitle 同一行：
   标题列 flex:1 自适应换行，select 用固定宽度，窄屏只压缩 select
   的宽度而不会被挤成一条竖缝（原来放行内整宽反而把标题顶到上方）。 */
.row-select {
  flex: 0 0 auto;
  width: 132px;
  max-width: 44vw;
  margin: 0;
}
/* 让 append 槽里的控件垂直居中（select 自带 40px 左右高度）。 */
.rows :deep(.v-list-item__append) {
  align-self: center;
}
.row-select :deep(.v-field) {
  border-radius: 10px;
}
/* 打平 v-select 的内部纵向留白：solo-filled 默认比 list-item 高，
   在 append 槽里会把整行撑高、看起来「掉下来」。 */
.row-select :deep(.v-field__input) {
  min-height: 36px;
  padding-block: 0;
  font-size: 14px;
}
.row-select :deep(.v-field__append-inner) {
  padding-block: 0;
}
.row-btn {
  flex: 0 0 auto;
}
</style>
