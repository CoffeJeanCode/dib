import { useEffect, useState } from "react";

const EVENT = "dib:theme";
const KEY   = "dib-theme";

export function getTheme(): "dark" | "light" {
  const stored = localStorage.getItem(KEY) as "dark" | "light" | null;
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function setTheme(t: "dark" | "light") {
  localStorage.setItem(KEY, t);
  document.documentElement.setAttribute("data-theme", t);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: t }));
}

export function clearThemeOverride() {
  localStorage.removeItem(KEY);
}

export function useTheme() {
  const [theme, setT] = useState<"dark" | "light">(getTheme);

  useEffect(() => {
    const onManual = (e: Event) => setT((e as CustomEvent<"dark" | "light">).detail);
    const onSystem = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(KEY)) setT(e.matches ? "dark" : "light");
    };
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener(EVENT, onManual);
    mq.addEventListener("change", onSystem);
    return () => {
      window.removeEventListener(EVENT, onManual);
      mq.removeEventListener("change", onSystem);
    };
  }, []);

  return { theme, setTheme };
}
