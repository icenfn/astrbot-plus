<script setup lang="ts">
import { computed, ref } from "vue";
import { useEventListener } from "@vueuse/core";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { parseQuickConnect, useSettingsStore } from "@/stores/settings";
import { useChatStore } from "@/stores/chat";
import {
  requestBackgroundRun,
  requestNotificationPermission,
} from "@/composables/useBackground";

/**
 * WizardView — first-run configuration.
 *
 * Two entry paths, both writing the same settings shape:
 *
 *   • 快连 (default): paste an `ap://email:password@host:port` URL. We parse
 *     it locally, swap the fields into settings, call `POST /api/auth/login`
 *     and — on success — jump straight to the 通知 / 后台 opt-in steps.
 *   • 手动: fill server address, then email + password, then 通知 / 后台.
 *
 * On finish we open the authenticated Socket.io connection and replace "/" .
 */
const router = useRouter();
const settings = useSettingsStore();
const chat = useChatStore();
const { connecting, lastError } = storeToRefs(settings);

type Mode = "quick" | "manual";
const mode = ref<Mode>("quick");

const quickUrl = ref("");
const manualServer = ref(settings.settings.serverUrl);
const manualEmail = ref(settings.settings.email);
const manualPassword = ref(settings.settings.password);

const notifyEnabled = ref(settings.settings.notifyEnabled);
const notifyMode = ref<"always" | "background">(
  settings.settings.notifyOnlyBackground ? "background" : "always",
);
const backgroundRun = ref(settings.settings.backgroundRun);

const notifyModes: { title: string; value: "always" | "background" }[] = [
  { title: "始终提醒", value: "always" },
  { title: "仅后台时提醒", value: "background" },
];

const canGoBack = computed(() => settings.hasCredentials);

// Steps depend on mode.
const steps = computed(() =>
  mode.value === "quick"
    ? (["快连", "通知与提醒", "后台运行"] as const)
    : (["服务器地址", "账号登录", "通知与提醒", "后台运行"] as const),
);
const LAST = computed(() => steps.value.length - 1);
const step = ref(0);

const canAdvance = computed(() => {
  if (mode.value === "quick") {
    if (step.value === 0) return quickUrl.value.trim().length > 0;
    return true;
  }
  if (step.value === 0) return manualServer.value.trim().length > 0;
  if (step.value === 1)
    return manualEmail.value.trim().length > 0 && manualPassword.value.length > 0;
  return true;
});
const isLast = computed(() => step.value === LAST.value);

function switchToManual(): void {
  mode.value = "manual";
  step.value = 0;
  lastError.value = "";
}

async function next(): Promise<void> {
  if (!canAdvance.value) return;

  // ---- quick-connect step: parse + login before advancing --------------
  if (mode.value === "quick" && step.value === 0) {
    const parsed = parseQuickConnect(quickUrl.value);
    if (!parsed) {
      lastError.value = "快连链接格式不正确，应为 ap://邮箱:密码@地址:端口";
      switchToManual();
      return;
    }
    settings.settings.serverUrl = parsed.serverUrl;
    settings.settings.email = parsed.email;
    settings.settings.password = parsed.password;
    settings.settings.jwtToken = "";
    settings.settings.currentUser = null;
    try {
      await settings.doLogin(parsed.email, parsed.password);
      // Success: advance to notify step (index 1 in quick mode).
      step.value = 1;
      lastError.value = "";
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e);
      // Fall back to manual with the parsed fields pre-filled.
      manualServer.value = parsed.serverUrl;
      manualEmail.value = parsed.email;
      manualPassword.value = parsed.password;
      switchToManual();
    }
    return;
  }

  // ---- manual credentials step: login before advancing -----------------
  if (mode.value === "manual" && step.value === 1) {
    settings.settings.serverUrl = manualServer.value.trim();
    settings.settings.email = manualEmail.value.trim();
    settings.settings.password = manualPassword.value;
    settings.settings.jwtToken = "";
    settings.settings.currentUser = null;
    try {
      await settings.doLogin(manualEmail.value.trim(), manualPassword.value);
      step.value = 2;
      lastError.value = "";
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e);
    }
    return;
  }

  if (step.value < LAST.value) {
    step.value += 1;
  } else {
    void finish();
  }
}

function prev(): void {
  if (step.value > 0) {
    step.value -= 1;
    return;
  }
  if (!canGoBack.value) return;
  const state = window.history.state as { back?: string | null } | null;
  if (state?.back) router.back();
  else void router.replace("/");
}

useEventListener(window, "android:back", () => prev());

async function finish(): Promise<void> {
  settings.settings.notifyEnabled = notifyEnabled.value;
  settings.settings.notifyOnlyBackground = notifyMode.value === "background";
  settings.settings.backgroundRun = backgroundRun.value;

  // We already have a JWT from doLogin; connect() will reuse it and open the
  // socket. Force a fresh socket in case the endpoint changed.
  const ok = await settings.connect();
  if (!ok) {
    // Send the user back to the credentials step to fix the error.
    step.value = mode.value === "quick" ? 0 : 1;
    return;
  }
  await chat.loadContacts();

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
          v-for="(s, i) in steps"
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
        <div :key="mode + '-' + step" class="step-pane">
          <!-- Quick-connect URL step -->
          <template v-if="mode === 'quick' && step === 0">
            <div class="hero">
              <v-icon icon="mdi-link-variant" size="64" color="primary" />
            </div>
            <h1 class="title">一键连接</h1>
            <p class="desc">粘贴快连链接（ap://邮箱:密码@地址:端口），自动完成登录。</p>

            <v-alert
              v-if="lastError"
              type="error"
              variant="tonal"
              density="compact"
              class="alert"
              :text="lastError"
            />

            <v-text-field
              v-model="quickUrl"
              label="快连链接"
              placeholder="ap://alice@test.com:secret@192.168.1.10:6199"
              prepend-inner-icon="mdi-link-variant"
              density="comfortable"
              variant="solo-filled"
              rounded="lg"
              flat
              hide-details
              autofocus
              class="field"
              @keyup.enter="next"
            />

            <v-btn
              variant="text"
              size="small"
              class="manual-link"
              @click="switchToManual"
            >
              手动录入
            </v-btn>
          </template>

          <!-- Manual: server address -->
          <template v-else-if="mode === 'manual' && step === 0">
            <div class="hero">
              <v-icon icon="mdi-server-network" size="64" color="primary" />
            </div>
            <h1 class="title">服务器地址</h1>
            <p class="desc">填写 AstrBot+ 后端的服务器地址（含端口）。</p>

            <v-alert
              v-if="lastError"
              type="error"
              variant="tonal"
              density="compact"
              class="alert"
              :text="lastError"
            />

            <v-text-field
              v-model="manualServer"
              label="服务器地址"
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

          <!-- Manual: email + password -->
          <template v-else-if="mode === 'manual' && step === 1">
            <div class="hero">
              <v-icon icon="mdi-account-key-outline" size="64" color="primary" />
            </div>
            <h1 class="title">账号登录</h1>
            <p class="desc">输入后端签发的邮箱和密码，用于获取访问令牌。</p>

            <v-alert
              v-if="lastError"
              type="error"
              variant="tonal"
              density="compact"
              class="alert"
              :text="lastError"
            />

            <v-text-field
              v-model="manualEmail"
              label="邮箱"
              placeholder="alice@test.com"
              prepend-inner-icon="mdi-email-outline"
              density="comfortable"
              variant="solo-filled"
              rounded="lg"
              flat
              hide-details
              autofocus
              class="field"
              autocomplete="username"
            />
            <v-text-field
              v-model="manualPassword"
              label="密码"
              placeholder="请输入密码"
              type="password"
              prepend-inner-icon="mdi-lock-outline"
              density="comfortable"
              variant="solo-filled"
              rounded="lg"
              flat
              hide-details
              class="field"
              autocomplete="current-password"
              @keyup.enter="next"
            />
          </template>

          <!-- Notify step (shared between both modes) -->
          <template v-else-if="step === steps.length - 2">
            <div class="hero">
              <v-icon icon="mdi-bell-ring-outline" size="64" color="primary" />
            </div>
            <h1 class="title">消息通知</h1>
            <p class="desc">开启后，收到新消息时会推送系统通知，不错过任何回复。</p>

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
                subtitle="始终提醒，或仅后台提醒"
                :disabled="!notifyEnabled"
              >
                <template #append>
                  <v-select
                    v-model="notifyMode"
                    :items="notifyModes"
                    item-title="title"
                    item-value="value"
                    class="row-select"
                    :disabled="!notifyEnabled"
                  />
                </template>
              </v-list-item>
            </v-list>
          </template>

          <!-- Background step (shared) -->
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
.manual-link {
  margin-top: 12px;
  opacity: 0.75;
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
  width: 132px;
  max-width: 44vw;
  margin: 0;
}
.rows :deep(.v-list-item__append) {
  align-self: center;
}
.row-select :deep(.v-field) {
  border-radius: 10px;
}
.row-select :deep(.v-field__input) {
  min-height: 36px;
  padding-block: 0;
  font-size: 14px;
}
.row-select :deep(.v-field__append-inner) {
  padding-block: 0;
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
