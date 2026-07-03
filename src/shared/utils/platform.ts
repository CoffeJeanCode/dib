export const isMac =
  typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");

export const MOD = isMac ? "⌘" : "Ctrl";

export function mod(s: string): string {
  return s.replace(/\bCtrl\b/g, MOD);
}
