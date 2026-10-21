<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getVersion, getName, getTauriVersion } from "@tauri-apps/api/app";
import { isTauri } from "@/api/env";

/**
 * AboutView — the 关于 AstrBot+ page.
 *
 * App identity is read from the Tauri runtime (`@tauri-apps/api/app`) so the
 * version shown always matches the actually installed build. When the page runs
 * outside a Tauri webview (plain `vite dev` / browser preview) those calls throw,
 * so we fall back to the version baked in at build time via `__APP_VERSION__`.
 */
const appName = ref("AstrBot+");
const appVersion = ref("");
const tauriVersion = ref("");
const loading = ref(true);

const repoUrl = "https://github.com/icenfn/astrbot-plus";

async function load(): Promise<void> {
  loading.value = true;
  if (isTauri()) {
    try {
      const [name, version, tauri] = await Promise.all([
        getName(),
        getVersion(),
        getTauriVersion(),
      ]);
      appName.value = name;
      appVersion.value = version;
      tauriVersion.value = tauri;
    } catch {
      /* fall through to the build-time fallback below */
    }
  }
  if (!appVersion.value) appVersion.value = __APP_VERSION__;
  loading.value = false;
}

onMounted(load);
</script>

<template>
  <div class="about">
    <div class="about-inner">
      <div class="brand">
        <img src="/logo.svg" alt="AstrBot+" width="88" height="88" />
        <h1 class="brand-name">{{ appName }}</h1>
        <div class="brand-version">
          <v-progress-circular v-if="loading" indeterminate size="14" width="2" class="mr-2" />
          版本 {{ appVersion || "—" }}
        </div>
      </div>

      <v-card class="card" variant="flat" rounded="lg">
        <v-list class="card-list">
          <v-list-item title="应用名称" :subtitle="appName" prepend-icon="mdi-application-outline" />
          <v-list-item title="应用版本" :subtitle="appVersion || '—'" prepend-icon="mdi-tag-outline" />
          <v-list-item
            title="Tauri 版本"
            :subtitle="tauriVersion || '（非 Tauri 环境）'"
            prepend-icon="mdi-hexagon-outline"
          />
          <v-divider />
          <v-list-item
            title="开源仓库"
            :subtitle="repoUrl"
            prepend-icon="mdi-github"
            :href="repoUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <template #append>
              <v-icon icon="mdi-open-in-new" size="20" />
            </template>
          </v-list-item>
        </v-list>
      </v-card>

      <p class="foot">由 AstrBot 驱动 · MIT License</p>
    </div>
  </div>
</template>

<style scoped>
.about {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 20px;
}
.about-inner {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 0 4px;
}
.brand-name {
  font-size: 22px;
  font-weight: 700;
  margin: 4px 0 0;
}
.brand-version {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  background: rgb(var(--v-theme-surface));
}
.card-list {
  background: transparent;
}
.foot {
  margin: 4px 0 8px;
  text-align: center;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.45);
}
</style>
