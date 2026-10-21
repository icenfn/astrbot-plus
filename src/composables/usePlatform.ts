import { computed } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { isTauri } from "@/api/env";

/**
 * Layout platform detection.
 *
 * A compact width (phones and narrow windows) switches the shell to a
 * mobile layout: a bottom tab bar instead of the left rail sidebar, and a
 * single-pane chat (list ⇄ conversation) instead of the two-pane desktop view.
 */
const MOBILE_QUERY = "(max-width: 900px)";
const mediaQuery = useMediaQuery(MOBILE_QUERY);

export function usePlatform() {
  const isMobile = computed(() => mediaQuery.value);
  return { isMobile, isTauri: isTauri() };
}
