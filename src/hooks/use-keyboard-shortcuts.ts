import { useEffect } from "react";

export function useKeyboardShortcuts(
  handlers: Record<string, () => void>,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      const handler = handlers[e.key.toLowerCase()];
      if (handler) {
        e.preventDefault();
        handler();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers, enabled]);
}
