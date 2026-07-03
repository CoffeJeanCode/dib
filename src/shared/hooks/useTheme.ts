import { useEffect } from "react";
import { useUiStore } from "@/store/uiStore";

const KEY = "dib-theme";

export function getTheme(): "dark" | "light" {
  const stored = localStorage.getItem(KEY) as "dark" | "light" | null;
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function setTheme(t: "dark" | "light") {
  localStorage.setItem(KEY, t);
  document.documentElement.setAttribute("data-theme", t);
  useUiStore.getState().setTheme(t);
}

export function clearThemeOverride() {
  localStorage.removeItem(KEY);
}

export function useTheme() {
  const theme = useUiStore((s) => s.theme);
  const storeSetTheme = useUiStore((s) => s.setTheme);

  useEffect(() => {
    const onSystem = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(KEY)) {
        const next = e.matches ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", next);
        storeSetTheme(next);
      }
    };
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", onSystem);
    return () => mq.removeEventListener("change", onSystem);
  }, [storeSetTheme]);

  return { theme, setTheme };
}
