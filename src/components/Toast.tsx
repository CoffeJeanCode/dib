import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Copy, X, AlertTriangle, Info } from "lucide-react";
import { useToastStore, type Toast as ToastType } from "@/store/toastStore";
import "./Toast.css";

const HIDE_ANIM_MS = 300;

function ToastItem({ toast }: { toast: ToastType }) {
  const remove = useToastStore((s) => s.remove);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    if (!toast.dismissible) {
      const t = setTimeout(() => setHiding(true), 6000 - HIDE_ANIM_MS);
      return () => clearTimeout(t);
    }
  }, [toast.dismissible]);

  const dismiss = () => {
    setHiding(true);
    setTimeout(() => remove(toast.id), HIDE_ANIM_MS);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(toast.message).catch(() => {});
  };

  const Icon = toast.type === "error" || toast.type === "warning" ? AlertTriangle : Info;

  return (
    <div className={`toast toast--${toast.type}${hiding ? " toast--hiding" : ""}`}>
      <div className={`toast-badge toast-badge--${toast.type}`}>
        <Icon size={12} strokeWidth={3} />
      </div>
      <span className="toast-message">{toast.message}</span>
      <button className="toast-copy-btn" onClick={handleCopy} title="Copy message">
        <Copy size={14} />
      </button>
      {toast.dismissible && (
        <button className="toast-close-btn" onClick={dismiss} title="Close">
          <X size={14} />
        </button>
      )}
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
