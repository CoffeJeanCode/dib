import { create } from "zustand";

export type ToastType = "info" | "success" | "error" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: Toast[];

  add: (message: string, type?: ToastType) => string;
  info: (message: string) => string;
  success: (message: string) => string;
  error: (message: string) => string;
  warn: (message: string) => string;
  remove: (id: string) => void;
  clear: () => void;
}

let toastId = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  add: (message: string, type: ToastType = "info") => {
    const id = `toast-${++toastId}`;
    const toast: Toast = { id, message, type };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    return id;
  },

  info: (message) => get().add(message, "info"),
  success: (message) => get().add(message, "success"),
  error: (message) => get().add(message, "error"),
  warn: (message) => get().add(message, "warning"),

  remove: (id: string) => {
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
  },

  clear: () => {
    set({ toasts: [] });
  },
}));
