import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./Tooltip.css";

interface TooltipProps {
  /** Tooltip body. Null/undefined renders children without a tooltip. */
  content: React.ReactNode;
  /** Single element child — used as the hover target and anchor. */
  children: React.ReactNode;
  delay?: number;
}

export function Tooltip({ content, children, delay = 300 }: TooltipProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<number>();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  if (content == null) return <>{children}</>;

  const show = () => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      // wrapper is display:contents (no box) — measure the real child
      const r = wrapRef.current?.firstElementChild?.getBoundingClientRect();
      if (r) setPos({ top: r.top - 6, left: r.left + r.width / 2 });
    }, delay);
  };

  const hide = () => {
    window.clearTimeout(timerRef.current);
    setPos(null);
  };

  return (
    <span ref={wrapRef} className="ui-tooltip-wrap" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {pos &&
        createPortal(
          <span className="ui-tooltip" role="tooltip" style={{ top: pos.top, left: pos.left }}>
            {content}
          </span>,
          document.body,
        )}
    </span>
  );
}
