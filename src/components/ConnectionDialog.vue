<script setup lang="ts">
import { ref } from "vue";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/stores/settings";
import { useChatStore } from "@/stores/chat";

const settings = useSettingsStore();
const chat = useChatStore();
const { connecting, lastError } = storeToRefs(settings);

const show = ref(false);
const draftKey = ref(settings.settings.apiKey);
const draftUrl = ref(settings.settings.baseUrl);
const draftWs = ref(settings.settings.wsUrl);
const draftWsToken = ref(settings.settings.wsToken);
const revealKey = ref(false);

function open() {
  draftKey.value = settings.settings.apiKey;
  draftUrl.value = settings.settings.baseUrl;
  draftWs.value = settings.settings.wsUrl;
  draftWsToken.value = settings.settings.wsToken;
  show.value = true;
}

async function save() {
  settings.settings.apiKey = draftKey.value.trim();
  settings.settings.baseUrl = draftUrl.value.trim();
  settings.settings.wsUrl = draftWs.value.trim();
  settings.settings.wsToken = draftWsToken.value.trim();
  // HTTP connection is used to list the AstrBot+ conversations…
  const ok = await settings.testConnection();
  if (ok) {
    // …while chat itself flows over the WebSocket adapter.
    chat.connectWs();
    await chat.loadContacts();
    show.value = false;
  }
}
</script>

<template>
  <div class="conn">
    <v-btn color="primary" size="large" prepend-icon="mdi-connection" @click="open">
      连接到 AstrBot 服务器
    </v-btn>

    <v-dialog v-model="show" max-width="560" persistent>
      <v-card class="pa-2">
        <v-card-title class="d-flex align-center ga-2">
          <v-icon icon="mdi-server-network" color="primary" />
          连接设置
        </v-card-title>
        <v-card-text class="d-flex flex-column ga-4">
          <v-alert
            v-if="lastError"
            type="error"
            variant="tonal"
            density="compact"
            :text="lastError"
          />
          <v-text-field
            v-model="draftUrl"
            label="AstrBot 服务器地址"
            placeholder="http://localhost:6185"
            prepend-inner-icon="mdi-web"
            hint="AstrBot 服务根地址，无需包含 /api"
            persistent-hint
          />
          <v-text-field
            v-model="draftKey"
            label="API Key"
            placeholder="abk_..."
            prepend-inner-icon="mdi-key-variant"
            :type="revealKey ? 'text' : 'password'"
            :append-inner-icon="revealKey ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="revealKey = !revealKey"
            hint="在 AstrBot 控制台「开发者 / API Key」中创建，需包含 im / chat 相关 scope"
            persistent-hint
          />
          <v-divider />
          <v-text-field
            v-model="draftWs"
            label="WebSocket 地址"
            placeholder="ws://localhost:6199/ws"
            prepend-inner-icon="mdi-transit-connection-variant"
            hint="由 astrbot-plugin-plus 插件提供，聊天消息经此 WebSocket 实时收发"
            persistent-hint
          />
          <v-text-field
            v-model="draftWsToken"
            label="WebSocket 令牌（可选）"
            placeholder="留空表示不校验"
            prepend-inner-icon="mdi-shield-key-outline"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="show = false">取消</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="connecting"
            prepend-icon="mdi-check"
            @click="save"
          >
            保存并连接
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
