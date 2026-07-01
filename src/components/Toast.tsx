import { createPortal } from "react-dom";
import { Copy, X, AlertTriangle, Info } from "lucide-react";
import { useToastStore, type Toast as ToastType } from "@/store/toastStore";
import "./Toast.css";

function ToastItem({ toast }: { toast: ToastType }) {
  const remove = useToastStore((s) => s.remove);

  const handleCopy = () => {
    navigator.clipboard.writeText(toast.message).catch(() => {});
  };

  const Icon = toast.type === "error" || toast.type === "warning" ? AlertTriangle : Info;

  return (
    <div className={`toast toast--${toast.type}`}>
      <div className={`toast-badge toast-badge--${toast.type}`}>
        <Icon size={12} strokeWidth={3} />
      </div>
      <span className="toast-message">{toast.message}</span>
      <button className="toast-copy-btn" onClick={handleCopy} title="Copy message">
        <Copy size={14} />
      </button>
      {toast.dismissible && (
        <button className="toast-close-btn" onClick={() => remove(toast.id)} title="Close">
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
