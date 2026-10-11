<script setup lang="ts">
import { ref } from "vue";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/stores/settings";
import { useChatStore } from "@/stores/chat";

const settings = useSettingsStore();
const chat = useChatStore();
const { connecting, lastError, connected } = storeToRefs(settings);

const show = ref(false);
const draftUrl = ref(settings.settings.socketUrl);

function open() {
  draftUrl.value = settings.settings.socketUrl;
  show.value = true;
}

async function save() {
  settings.settings.socketUrl = draftUrl.value.trim();
  const ok = await settings.connect();
  if (ok) {
    await chat.loadContacts();
    chat.startPolling(settings.settings.pollIntervalSec * 1000);
    show.value = false;
  }
}
</script>

<template>
  <div class="conn">
    <v-btn color="primary" size="large" prepend-icon="mdi-connection" @click="open">
      连接到 AstrBot+ 插件
    </v-btn>

    <v-dialog v-model="show" max-width="520" persistent>
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
            label="插件服务器地址"
            placeholder="例如 192.168.1.10:6199 或 ws://192.168.1.10:6199"
            prepend-inner-icon="mdi-web"
            hint="AstrBot+ 配套插件对外暴露的唯一端口，支持 host:6199、http:// 或 ws:// 写法，无需包含路径"
            persistent-hint
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
