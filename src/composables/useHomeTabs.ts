import { computed, ref } from "vue";

/**
 * Shared state for the 首页 (home) frame.
 *
 * The three primary pages (消息 / 联系人 / 我的) are EMBEDDED in `HomeLayout` and
 * switched by `v-show`, not by routing. That keeps each page's scroll position
 * and live state, removes the router transition flicker, and guarantees the same
 * background/margins across the three panes. This composable is the single source
 * of truth shared by the layout, the bottom tab bar, the side rail and the
 * application bar.
 */

export type HomeTabName = "chats" | "contacts" | "mine";

export interface HomeTabDef {
  name: HomeTabName;
  label: string;
  title: string;
  icon: string;
  activeIcon: string;
}

export const homeTabs: HomeTabDef[] = [
  {
    name: "chats",
    label: "消息",
    title: "消息",
    icon: "mdi-forum-outline",
    activeIcon: "mdi-forum",
  },
  {
    name: "contacts",
    label: "联系人",
    title: "联系人",
    icon: "mdi-account-multiple-outline",
    activeIcon: "mdi-account-multiple",
  },
  {
    name: "mine",
    label: "我的",
    title: "我的",
    icon: "mdi-account-circle-outline",
    activeIcon: "mdi-account-circle",
  },
];

// Module-scoped so every consumer observes the same selection.
const activeHomeTab = ref<HomeTabName>("chats");

export function useHomeTabs() {
  const activeTab = computed(
    () => homeTabs.find((t) => t.name === activeHomeTab.value) ?? homeTabs[0],
  );
  function selectTab(name: HomeTabName): void {
    activeHomeTab.value = name;
  }
  return { activeHomeTab, activeTab, homeTabs, selectTab };
}
