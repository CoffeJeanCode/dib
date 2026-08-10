import { createPortal } from "react-dom";
import { useEffect, useState, useCallback, useRef } from "react";
import { Copy, X, AlertTriangle, Info, Check, ChevronDown, ChevronUp } from "lucide-react";
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
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const msgRef = useRef<HTMLSpanElement>(null);

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

  useEffect(() => {
    if (expanded) return;
    const el = msgRef.current;
    if (!el) return;
    const check = () => setTruncated(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [toast.message, expanded]);

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
        <Icon size={14} strokeWidth={2.5} />
      </div>
      <div className="toast-body">
        <span
          ref={msgRef}
          className={`toast-message${expanded ? " toast-message--expanded" : ""}`}
        >
          {toast.message}
        </span>
        {truncated && (
          <button
            className="toast-more-btn"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? "View less" : "View more"}
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>
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
