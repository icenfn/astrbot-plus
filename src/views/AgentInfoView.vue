<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { storeToRefs } from "pinia";
import { useChatStore } from "@/stores/chat";
import { useSettingsStore } from "@/stores/settings";
import AstrbotAvatar from "@/components/AstrbotAvatar.vue";
import type { PluginConfig } from "@/api/types";

/**
 * AgentInfoView — the read-only「Agent 信息」page, opened from the message
 * page's application-bar info button (`/agent/:id`).
 *
 * Shows the Agent's `bot_id` (the stable key shared with the WebUI「创建机器人」
 * page) plus the partial configuration the plugin exposes: display name, platform
 * adapter, enabled state, and the companion plugin's server capabilities
 * (`config` event: plugin name / version / port). Rendered inside `BackLayout`,
 * so it carries the standard back button.
 */
const route = useRoute();
const chat = useChatStore();
const settings = useSettingsStore();
const { agents } = storeToRefs(chat);

const botId = computed(() => (typeof route.params.id === "string" ? route.params.id : ""));

// Prefer the live store row (name / avatar / platform / enabled); fall back to
// the raw id when the Agent is not in the current list (e.g. a deep link).
const agent = computed(() => agents.value.find((a) => a.id === botId.value) ?? null);
const displayName = computed(() => agent.value?.name || botId.value);
const displaySeed = computed(() => agent.value?.avatarSeed || botId.value);

const config = ref<PluginConfig | null>(null);
const loadingConfig = ref(false);

const enabledText = computed(() => {
  const e = agent.value?.enabled;
  if (e === true) return "已启用";
  if (e === false) return "已停用";
  return "未知";
});

async function loadConfig(): Promise<void> {
  if (!settings.connected) return;
  loadingConfig.value = true;
  try {
    config.value = await settings.getSocket().getConfig();
  } catch {
    config.value = null;
  } finally {
    loadingConfig.value = false;
  }
}

onMounted(loadConfig);
</script>

<template>
  <div class="agent-info">
    <div class="agent-info-inner">
      <div class="hero">
        <AstrbotAvatar :name="displayName" :seed="displaySeed" :size="88" />
        <h1 class="hero-name">{{ displayName }}</h1>
        <div class="hero-sub">AstrBot Agent</div>
      </div>

      <v-card class="card" variant="flat" rounded="lg">
        <div class="card-title">Agent 配置</div>
        <v-list class="card-list" lines="two">
          <v-list-item prepend-icon="mdi-identifier" title="Bot ID">
            <template #subtitle>
              <span class="mono">{{ botId || "—" }}</span>
            </template>
          </v-list-item>
          <v-list-item
            prepend-icon="mdi-account-outline"
            title="显示名称"
            :subtitle="displayName"
          />
          <v-list-item
            prepend-icon="mdi-connection"
            title="平台适配器"
            :subtitle="agent?.platform || '—'"
          />
          <v-list-item
            prepend-icon="mdi-toggle-switch-outline"
            title="启用状态"
            :subtitle="enabledText"
          >
            <template #append>
              <v-chip
                size="small"
                variant="tonal"
                :color="agent?.enabled === false ? 'error' : 'success'"
              >
                {{ enabledText }}
              </v-chip>
            </template>
          </v-list-item>
        </v-list>
      </v-card>

      <v-card class="card" variant="flat" rounded="lg">
        <div class="card-title d-flex align-center">
          服务端信息
          <v-progress-circular
            v-if="loadingConfig"
            indeterminate
            size="14"
            width="2"
            class="ml-2"
          />
        </div>
        <v-list class="card-list" lines="two">
          <v-list-item
            prepend-icon="mdi-puzzle-outline"
            title="插件名称"
            :subtitle="config?.plugin || '—'"
          />
          <v-list-item
            prepend-icon="mdi-tag-outline"
            title="插件版本"
            :subtitle="config?.version || '—'"
          />
          <v-list-item
            prepend-icon="mdi-lan-connect"
            title="插件端口"
            :subtitle="config?.port != null ? String(config.port) : '—'"
          />
        </v-list>
        <p v-if="!settings.connected" class="hint">
          未连接插件，服务端信息暂不可用。
        </p>
      </v-card>
    </div>
  </div>
</template>

<style scoped>
.agent-info {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 16px;
}
.agent-info-inner {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 0 4px;
}
.hero-name {
  font-size: 20px;
  font-weight: 700;
  margin: 4px 0 0;
}
.hero-sub {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  background: rgb(var(--v-theme-surface));
  padding: 4px 0 8px;
}
.card-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.6);
  padding: 12px 16px 4px;
}
.card-list {
  background: transparent;
}
.mono {
  font-family: ui-monospace, "SFMono-Regular", "Menlo", monospace;
  word-break: break-all;
}
.hint {
  margin: 4px 16px 8px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
</style>
