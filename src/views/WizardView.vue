<script setup lang="ts">
import { computed, ref } from "vue";
import { useEventListener } from "@vueuse/core";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/stores/settings";
import { useChatStore } from "@/stores/chat";
import {
  requestBackgroundRun,
  requestNotificationPermission,
} from "@/composables/useBackground";

/**
 * WizardView — the standalone 配置向导 page.
 *
 * A HyperOS-style, step-by-step first-run flow that keeps one decision per screen,
 * renders a large illustration + concise copy, and advances through a bottom action
 * button. It is opened automatically while the app has no plugin address configured
 * (router guard) and re-entered from 设置 → 连接 →「重新配置」.
 *
 * Steps:
 *   0. 服务器地址  — where the AstrBot+ plugin lives
 *   1. 通知与提醒  — enable notifications + choose when to be reminded
 *   2. 后台运行    — keep the connection alive in the background
 */
const router = useRouter();
const settings = useSettingsStore();
const chat = useChatStore();
const { connecting, lastError } = storeToRefs(settings);

const STEPS = ["服务器地址", "通知与提醒", "后台运行"] as const;
const LAST = STEPS.length - 1;

const step = ref(0);
const draftUrl = ref(settings.settings.socketUrl);
const notifyEnabled = ref(settings.settings.notifyEnabled);
const notifyMode = ref<"always" | "background">(
  settings.settings.notifyOnlyBackground ? "background" : "always",
);
const backgroundRun = ref(settings.settings.backgroundRun);

const notifyModes: { title: string; value: "always" | "background" }[] = [
  { title: "始终提醒", value: "always" },
  { title: "仅后台时提醒", value: "background" },
];

// When the app is already configured the wizard was reached via 「重新配置」, so a
// way back to the app is offered; on a first run there is nothing to return to.
const canGoBack = computed(() => settings.hasCredentials);
const canAdvance = computed(() => {
  if (step.value === 0) return draftUrl.value.trim().length > 0;
  return true;
});
const isLast = computed(() => step.value === LAST);

function next(): void {
  if (!canAdvance.value) return;
  if (step.value < LAST) step.value += 1;
  else void finish();
}

function prev(): void {
  if (step.value > 0) step.value -= 1;
  else if (canGoBack.value) void router.replace("/");
}

// The Android hardware back key walks the wizard one step at a time (App.vue
// deliberately ignores it on this route so it never skips the whole wizard).
useEventListener(window, "android:back", () => prev());

async function finish(): Promise<void> {
  settings.settings.socketUrl = draftUrl.value.trim();
  settings.settings.notifyEnabled = notifyEnabled.value;
  settings.settings.notifyOnlyBackground = notifyMode.value === "background";
  settings.settings.backgroundRun = backgroundRun.value;

  const ok = await settings.connect();
  if (!ok) {
    // Surface the error on the address step so the user can correct it.
    step.value = 0;
    return;
  }
  await chat.loadContacts();

  // Opt-in side effects, requested only now (never on a cold start).
  if (notifyEnabled.value) requestNotificationPermission();
  if (backgroundRun.value) void requestBackgroundRun();

  void router.replace("/");
}
</script>

<template>
  <div class="wizard">
    <!-- Top bar: back + step progress -->
    <div class="wizard-top">
      <v-btn
        icon="mdi-arrow-left"
        variant="text"
        :ripple="false"
        :disabled="step === 0 && !canGoBack"
        title="返回"
        @click="prev"
      />
      <div class="steps">
        <span
          v-for="(s, i) in STEPS"
          :key="s"
          class="step-dot"
          :class="{ 'is-active': i === step, 'is-done': i < step }"
        />
      </div>
      <div class="top-spacer" />
    </div>

    <!-- Body -->
    <div class="wizard-body">
      <transition name="step" mode="out-in">
        <div :key="step" class="step-pane">
          <!-- Step 0: server address -->
          <template v-if="step === 0">
            <div class="hero">
              <v-icon icon="mdi-server-network" size="64" color="primary" />
            </div>
            <h1 class="title">连接到你的 AstrBot</h1>
            <p class="desc">填写 AstrBot+ 配套插件的服务器地址，连接后即可与你的 Agent 对话。</p>

            <v-alert
              v-if="lastError"
              type="error"
              variant="tonal"
              density="compact"
              class="alert"
              :text="lastError"
            />

            <v-text-field
              v-model="draftUrl"
              label="插件服务器地址"
              placeholder="例如 192.168.1.10:6199"
              prepend-inner-icon="mdi-web"
              density="comfortable"
              variant="solo-filled"
              rounded="lg"
              flat
              hide-details
              autofocus
              class="field"
              @keyup.enter="next"
            />
          </template>

          <!-- Step 1: notifications -->
          <template v-else-if="step === 1">
            <div class="hero">
              <v-icon icon="mdi-bell-ring-outline" size="64" color="primary" />
            </div>
            <h1 class="title">消息通知</h1>
            <p class="desc">开启后，收到 Agent 的新消息时会推送系统通知，不错过任何回复。</p>

            <v-list class="rows" density="comfortable">
              <v-list-item
                title="开启消息通知"
                subtitle="收到新消息时推送系统通知"
              >
                <template #append>
                  <v-switch
                    v-model="notifyEnabled"
                    color="primary"
                    density="compact"
                    hide-details
                    class="row-switch"
                  />
                </template>
              </v-list-item>
              <v-list-item
                title="通知方式"
                subtitle="选择提醒时机：始终提醒，或仅当 App 在后台时提醒"
                :disabled="!notifyEnabled"
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
                    :disabled="!notifyEnabled"
                  />
                </template>
              </v-list-item>
            </v-list>
          </template>

          <!-- Step 2: background running -->
          <template v-else>
            <div class="hero">
              <v-icon icon="mdi-power-sleep" size="64" color="primary" />
            </div>
            <h1 class="title">保持在线</h1>
            <p class="desc">允许后台运行，App 退到后台时也能保持连接、持续接收消息。</p>

            <v-list class="rows" density="comfortable">
              <v-list-item
                title="允许后台运行"
                subtitle="退到后台时保持连接并接收消息（需要通知与电池优化权限）"
              >
                <template #append>
                  <v-switch
                    v-model="backgroundRun"
                    color="primary"
                    density="compact"
                    hide-details
                    class="row-switch"
                  />
                </template>
              </v-list-item>
            </v-list>
          </template>
        </div>
      </transition>
    </div>

    <!-- Bottom action -->
    <div class="wizard-foot">
      <v-btn
        color="primary"
        size="large"
        block
        class="cta"
        :disabled="!canAdvance"
        :loading="isLast && connecting"
        @click="next"
      >
        {{ isLast ? "完成" : "下一步" }}
      </v-btn>
    </div>
  </div>
</template>

<style scoped>
.wizard {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
  padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
}
.wizard-top {
  flex: 0 0 auto;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
}
.top-spacer {
  width: 40px;
}
.steps {
  display: flex;
  align-items: center;
  gap: 8px;
}
.step-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.2);
  transition:
    width 0.25s ease,
    background 0.25s ease;
}
.step-dot.is-active {
  width: 22px;
  background: rgb(var(--v-theme-primary));
}
.step-dot.is-done {
  background: rgba(var(--v-theme-primary), 0.5);
}

.wizard-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.wizard-body::-webkit-scrollbar {
  display: none;
}
.step-pane {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 20px 20px;
  overflow: visible;
}
.hero {
  width: 108px;
  height: 108px;
  border-radius: 32px;
  display: grid;
  place-items: center;
  background: rgba(var(--v-theme-primary), 0.12);
  margin-bottom: 22px;
}
.title {
  font-size: 24px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
  text-align: center;
  margin: 0;
}
.desc {
  margin: 10px 0 4px;
  max-width: 420px;
  text-align: center;
  font-size: 14px;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.alert {
  width: 100%;
  max-width: 420px;
  margin-top: 16px;
}
.field {
  width: 100%;
  max-width: 420px;
  margin-top: 22px;
}
/* Fixed height: the address field must not change height while typing / on error
   (details area is hidden; a fixed 56px keeps the step layout rock-steady). */
.field :deep(.v-field) {
  height: 56px;
}
.field :deep(.v-field__input) {
  padding-top: 0;
  padding-bottom: 0;
  min-height: 56px;
}
.field :deep(.v-input__details) {
  display: none;
}
.rows {
  width: 100%;
  max-width: 420px;
  margin-top: 18px;
  background: transparent;
  padding: 0;
}
.rows :deep(.v-list-item) {
  padding-inline: 4px;
  min-height: 56px;
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
  width: 140px;
  max-width: 48%;
  margin: 0;
}
.row-select :deep(.v-field) {
  border-radius: 10px;
}

.wizard-foot {
  flex: 0 0 auto;
  padding: 12px 24px calc(16px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
}
.cta {
  max-width: 420px;
  margin: 0 auto;
  border-radius: 14px;
}

/* Step transition */
.step-enter-active,
.step-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.step-enter-from {
  opacity: 0;
  transform: translateX(24px);
}
.step-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}
</style>
