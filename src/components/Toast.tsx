import { createPortal } from "react-dom";
import { Copy, X } from "lucide-react";
import type { Toast as ToastType } from "../hooks/useToast";
import "./Toast.css";

interface ToastContainerProps {
  toasts: ToastType[];
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: { toast: ToastType; onDismiss: (id: string) => void }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(toast.message).catch(() => {});
  };

  return (
    <div className={`toast pattern-halftone toast--${toast.type}`}>
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
