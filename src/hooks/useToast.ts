import { useState, useCallback, useRef } from "react";

export type ToastType = "info" | "error";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  dismissible: boolean;
}

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = `toast-${++toastId}`;
      const toast: Toast = { id, message, type, dismissible: type === "error" };
      setToasts((prev) => [...prev, toast]);

      if (type === "info") {
        const t = setTimeout(() => remove(id), 5000);
        timers.current.set(id, t);
      }

      return id;
    },
    [remove],
  );

  const info = useCallback((message: string) => addToast(message, "info"), [addToast]);
  const error = useCallback((message: string) => addToast(message, "error"), [addToast]);

  return { toasts, info, error, remove };
}
