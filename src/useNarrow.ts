import { useSyncExternalStore } from "react";

/** Below this width the detail pane opens as a drawer instead of sitting beside the list. */
export const NARROW_QUERY = "(max-width: 800px)";

const query = () => (typeof window.matchMedia === "function" ? window.matchMedia(NARROW_QUERY) : null);

export function useNarrow(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mql = query();
      mql?.addEventListener("change", notify);
      return () => mql?.removeEventListener("change", notify);
    },
    () => query()?.matches ?? false,
  );
}
