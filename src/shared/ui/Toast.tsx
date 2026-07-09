import { createPortal } from "react-dom";
import { useEffect, useState, useCallback } from "react";
import { Copy, X, AlertTriangle, Info, Check } from "lucide-react";
import { useToastStore, type Toast as ToastType } from "@/store/toastStore";
import "./Toast.css";

const HIDE_ANIM_MS = 300;
const INFO_TIMEOUT = 4000;
const SUCCESS_TIMEOUT = 4000;
const WARN_TIMEOUT = 5000;
const ERROR_TIMEOUT = 8000;

function ToastItem({ toast }: { toast: ToastType }) {
  const remove = useToastStore((s) => s.remove);
  const [hiding, setHiding] = useState(false);

  const doRemove = useCallback(() => {
    setHiding(true);
    setTimeout(() => remove(toast.id), HIDE_ANIM_MS);
  }, [remove, toast.id]);

  useEffect(() => {
    const timeout =
      toast.type === "error" ? ERROR_TIMEOUT
      : toast.type === "warning" ? WARN_TIMEOUT
      : toast.type === "success" ? SUCCESS_TIMEOUT
      : INFO_TIMEOUT;
    const t = setTimeout(doRemove, timeout);
    return () => clearTimeout(t);
  }, [toast.type, doRemove]);

  const dismiss = () => doRemove();

  const handleCopy = () => {
    navigator.clipboard.writeText(toast.message).catch(() => {});
  };

  const Icon = toast.type === "success" ? Check
    : toast.type === "error" || toast.type === "warning" ? AlertTriangle
    : Info;

  return (
    <div className={`toast toast--${toast.type}${hiding ? " toast--hiding" : ""}`}>
      <div className={`toast-badge toast-badge--${toast.type}`}>
        <Icon size={12} strokeWidth={3} />
      </div>
      <span className="toast-message">{toast.message}</span>
      <button className="toast-copy-btn" onClick={handleCopy} title="Copy message">
        <Copy />
      </button>
      <button className="toast-close-btn" onClick={dismiss} title="Close">
        <X />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (!toasts.length) return null;

  return createPortal(
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>,
    document.body,
  );
}
