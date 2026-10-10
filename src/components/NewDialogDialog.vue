<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useChatStore } from "@/stores/chat";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const chat = useChatStore();
const { bots } = storeToRefs(chat);

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const botId = ref<string | undefined>(undefined);
const saving = ref(false);
const error = ref("");

watch(open, (v) => {
  if (v) {
    botId.value = undefined;
    error.value = "";
  }
});

const botItems = computed(() =>
  bots.value.map((b) => ({
    title: b.name || b.id,
    value: b.id,
    subtitle: b.platform || undefined,
  })),
);

async function save() {
  saving.value = true;
  error.value = "";
  try {
    const bot = botId.value ? bots.value.find((b) => b.id === botId.value) : undefined;
    const dialog = bot ? await chat.ensureBotDialog(bot) : await chat.addDialog();
    const target = chat.contacts.find((c) => c.kind === "dialog" && c.id === dialog.id);
    if (target) chat.openTarget(target);
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
        <v-icon icon="mdi-chat-plus-outline" color="primary" />
        新建对话
      </v-card-title>
      <v-card-text class="d-flex flex-column ga-4">
        <v-alert v-if="error" type="error" variant="tonal" density="compact" :text="error" />
        <v-select
          v-model="botId"
          :items="botItems"
          label="选择机器人（可选）"
          placeholder="留空则创建一段默认对话"
          prepend-inner-icon="mdi-robot"
          clearable
          no-data-text="还没有机器人，请先在 AstrBot WebUI 的「创建机器人」页面添加"
        />
        <p class="text-caption text-medium-emphasis">
          对话直接与 AstrBot 的 Webchat 沟通；选择机器人后，该机器人会与这段对话 1:1 绑定，
          再次新建将复用已有对话。
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
