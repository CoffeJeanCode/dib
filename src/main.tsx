import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./theme.css";
import "./monaco-overrides.css";
import { getTheme } from "@/hooks/useTheme";

// Apply data-theme on startup (respects localStorage override, else OS pref)
document.documentElement.setAttribute("data-theme", getTheme());

// On OS preference change, only follow it when no manual override is set
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (!localStorage.getItem("dib-theme"))
    document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
