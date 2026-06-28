import { createPortal } from "react-dom";
import { Copy, X, AlertTriangle, Info } from "lucide-react";
import type { Toast as ToastType } from "@/hooks/useToast";
import "./Toast.css";

interface ToastContainerProps {
  toasts: ToastType[];
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: { toast: ToastType; onDismiss: (id: string) => void }) {
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
      <button className="toast-copy-btn" onClick={handleCopy} title="Copiar mensaje">
        <Copy size={14} />
      </button>
      {toast.dismissible && (
        <button className="toast-close-btn" onClick={() => onDismiss(toast.id)} title="Cerrar">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (!toasts.length) return null;

  return createPortal(
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}
