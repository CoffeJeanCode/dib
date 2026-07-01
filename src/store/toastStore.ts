import { create } from "zustand";

export type ToastType = "info" | "error" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  dismissible: boolean;
}

interface ToastState {
  toasts: Toast[];
  /** Auto-incrementing counter so addToast never collides across sessions */
  _counter: number;
  /** Map of active auto-dismiss timers for cleanup */
  _timers: Map<string, ReturnType<typeof setTimeout>>;

  add: (message: string, type?: ToastType) => string;
  info: (message: string) => string;
  error: (message: string) => string;
  warn: (message: string) => string;
  remove: (id: string) => void;
  /** Remove all toasts — used on unmount */
  clear: () => void;
}

let toastId = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  _counter: 0,
  _timers: new Map(),

  add: (message: string, type: ToastType = "info") => {
    const id = `toast-${++toastId}`;
    const dismissible = type === "error";
    const toast: Toast = { id, message, type, dismissible };

    set((s) => ({ toasts: [...s.toasts, toast], _counter: s._counter + 1 }));

    // Auto-dismiss info and warning toasts after 6s
    if (type === "info" || type === "warning") {
      const t = setTimeout(() => {
        get().remove(id);
      }, 6000);
      get()._timers.set(id, t);
    }

    return id;
  },

  info: (message) => get().add(message, "info"),
  error: (message) => get().add(message, "error"),
  warn: (message) => get().add(message, "warning"),

  remove: (id: string) => {
    const timers = get()._timers;
    const t = timers.get(id);
    if (t) {
      clearTimeout(t);
      timers.delete(id);
    }
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
  },

  clear: () => {
    // Clear all active timers
    const timers = get()._timers;
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
    set({ toasts: [] });
  },
}));
