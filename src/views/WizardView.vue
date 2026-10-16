<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/stores/settings";
import { useChatStore } from "@/stores/chat";

/**
 * WizardView — the standalone 配置向导 page.
 *
 * It is opened automatically while the app has no plugin address configured
 * (see the router guard) and can be re-entered at any time from 设置 → 连接 →
 * 「重新配置」. It collects the single plugin endpoint the client needs and, on a
 * successful connection, hands control back to the 首页 frame.
 */
const router = useRouter();
const settings = useSettingsStore();
const chat = useChatStore();
const { connecting, lastError } = storeToRefs(settings);

const draftUrl = ref(settings.settings.socketUrl);

// When the app is already configured the wizard was reached via 「重新配置」, so a
// way back to the app is offered; on a first run there is nothing to return to.
const canGoBack = computed(() => settings.hasCredentials);

async function submit(): Promise<void> {
  settings.settings.socketUrl = draftUrl.value.trim();
  const ok = await settings.connect();
  if (ok) {
    await chat.loadContacts();
    void router.replace("/");
  }
}

function goBack(): void {
  void router.replace("/");
}
</script>

<template>
  <div class="wizard">
    <div class="wizard-top">
      <v-btn
        v-if="canGoBack"
        icon="mdi-arrow-left"
        variant="text"
        :ripple="false"
        title="返回"
        @click="goBack"
      />
    </div>

    <div class="wizard-inner">
      <img src="/logo.svg" alt="AstrBot+" width="88" height="88" />
      <h1 class="wizard-title">配置 AstrBot+</h1>
      <p class="wizard-desc">填写 AstrBot+ 配套插件的服务器地址，连接后即可与你的 Agent 对话。</p>

      <v-alert
        v-if="lastError"
        type="error"
        variant="tonal"
        density="compact"
        class="wizard-alert"
        :text="lastError"
      />

      <v-text-field
        v-model="draftUrl"
        label="插件服务器地址"
        placeholder="例如 192.168.1.10:6199 或 ws://192.168.1.10:6199"
        prepend-inner-icon="mdi-web"
        density="comfortable"
        variant="solo-filled"
        flat
        hide-details
        class="wizard-field"
        @keyup.enter="submit"
      />

      <v-btn
        color="primary"
        size="large"
        block
        class="wizard-submit"
        :loading="connecting"
        prepend-icon="mdi-connection"
        @click="submit"
      >
        连接
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
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 6px;
}
.wizard-inner {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.wizard-title {
  font-size: 22px;
  font-weight: 600;
  margin-top: 16px;
  color: rgb(var(--v-theme-on-surface));
}
.wizard-desc {
  margin-top: 8px;
  margin-bottom: 20px;
  max-width: 420px;
  text-align: center;
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.wizard-alert {
  width: 100%;
  max-width: 420px;
  margin-bottom: 12px;
}
.wizard-field {
  width: 100%;
  max-width: 420px;
}
.wizard-field :deep(.v-field) {
  border-radius: 10px;
}
.wizard-submit {
  width: 100%;
  max-width: 420px;
  margin-top: 16px;
}
</style>
