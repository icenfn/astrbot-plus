<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useChatStore } from "@/stores/chat";
import AstrbotAvatar from "./AstrbotAvatar.vue";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const chat = useChatStore();
const { friends } = storeToRefs(chat);

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const name = ref("");
const selected = ref<string[]>([]);
const saving = ref(false);
const error = ref("");

watch(open, (v) => {
  if (v) {
    name.value = "";
    selected.value = [];
    error.value = "";
  }
});

const canSave = computed(() => name.value.trim().length > 0 && selected.value.length >= 2);

function toggle(id: string) {
  const i = selected.value.indexOf(id);
  if (i >= 0) selected.value.splice(i, 1);
  else selected.value.push(id);
}

async function save() {
  if (!canSave.value) {
    error.value = "请填写群名称并至少选择 2 个 AI 好友";
    return;
  }
  saving.value = true;
  error.value = "";
  try {
    const g = await chat.createGroup({ name: name.value.trim(), memberIds: selected.value });
    if (!g) {
      error.value = "创建失败：至少需要 2 个 AI 好友";
      return;
    }
    open.value = false;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="480">
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <v-icon icon="mdi-account-multiple-plus" color="primary" />
        新建群聊
      </v-card-title>
      <v-card-text class="d-flex flex-column ga-4">
        <v-alert v-if="error" type="error" variant="tonal" density="compact" :text="error" />
        <v-text-field
          v-model="name"
          label="群聊名称"
          placeholder="例如：头脑风暴群"
          prepend-inner-icon="mdi-forum"
        />

        <div>
          <div class="pick-label">
            选择 AI 好友（至少 2 个，已选 {{ selected.length }}）
          </div>
          <div v-if="!friends.length" class="text-caption text-medium-emphasis mt-2">
            还没有 AI 好友，请先新建 AI 好友。
          </div>
          <div v-else class="pick-list">
            <button
              v-for="f in friends"
              :key="f.id"
              type="button"
              class="pick"
              :class="{ on: selected.includes(f.id) }"
              @click="toggle(f.id)"
            >
              <AstrbotAvatar :name="f.name" :seed="f.avatarSeed" :size="30" />
              <span class="pick-name">{{ f.name }}</span>
              <v-icon
                :icon="selected.includes(f.id) ? 'mdi-check-circle' : 'mdi-circle-outline'"
                :color="selected.includes(f.id) ? 'primary' : undefined"
                size="20"
              />
            </button>
          </div>
        </div>

        <p class="text-caption text-medium-emphasis">
          发送消息时，文本会同时发给每位成员，且每位 AI 在群内拥有独立的会话上下文。
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">取消</v-btn>
        <v-btn color="primary" variant="flat" :disabled="!canSave" :loading="saving" @click="save">
          创建
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.pick-label {
  font-size: 12.5px;
  opacity: 0.72;
  margin-bottom: 6px;
}
.pick-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 260px;
  overflow-y: auto;
}
.pick {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 10px;
  border: 1px solid rgba(128, 150, 170, 0.24);
  border-radius: 12px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.pick.on {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(47, 134, 189, 0.12);
}
.pick-name {
  flex: 1 1 auto;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
