<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/stores/settings";
import { useChatStore } from "@/stores/chat";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const settings = useSettingsStore();
const chat = useChatStore();
const { providers } = storeToRefs(settings);

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

import { ref, watch } from "vue";
const name = ref("");
const configId = ref<string | undefined>(undefined);
const personaId = ref("");
const saving = ref(false);
const error = ref("");

watch(open, (v) => {
  if (v) {
    name.value = "";
    configId.value = undefined;
    personaId.value = "";
    error.value = "";
  }
});

const providerItems = computed(() =>
  providers.value.map((p) => ({
    title: `${p.id}${p.model ? ` · ${p.model}` : ""}`,
    value: p.id,
  })),
);

async function save() {
  name.value = name.value.trim();
  if (!name.value) {
    error.value = "请填写名称";
    return;
  }
  saving.value = true;
  error.value = "";
  try {
    await chat.addFriend({
      name: name.value,
      configId: configId.value,
      personaId: personaId.value.trim() || undefined,
    });
    open.value = false;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="460">
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <v-icon icon="mdi-account-plus" color="primary" />
        新建 AI 好友
      </v-card-title>
      <v-card-text class="d-flex flex-column ga-4">
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          :text="error"
        />
        <v-text-field
          v-model="name"
          label="名称"
          placeholder="例如：小助手"
          prepend-inner-icon="mdi-account"
        />
        <v-select
          v-model="configId"
          :items="providerItems"
          label="对话配置 / 模型（可选）"
          placeholder="留空则使用 AstrBot 默认配置"
          prepend-inner-icon="mdi-robot"
          clearable
        />
        <v-text-field
          v-model="personaId"
          label="人格 ID（可选）"
          placeholder="留空则使用默认人格"
          prepend-inner-icon="mdi-face-agent"
        />
        <p class="text-caption text-medium-emphasis">
          每个 AI 好友在私聊与群聊中都拥有独立的会话上下文（独立 UMO），互不干扰。
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">取消</v-btn>
        <v-btn color="primary" variant="flat" :loading="saving" @click="save">创建</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
