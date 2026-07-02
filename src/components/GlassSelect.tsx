import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import "./GlassSelect.css";

export type GlassSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
};

export const GlassSelect = forwardRef<HTMLSelectElement, GlassSelectProps>(
  ({ label, error, className = "", id, children, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="glass-field">
        {label && (
          <label className="glass-label" htmlFor={selectId}>
            {label}
          </label>
        )}
        <div className="glass-select-wrapper">
          <select
            ref={ref}
            id={selectId}
            className={`glass-select ${error ? "glass-select--error" : ""} ${className}`}
            {...props}
          >
            {children}
          </select>
          <ChevronDown size={14} className="glass-select-arrow" aria-hidden />
        </div>
        {error && <span className="glass-error">{error}</span>}
      </div>
    );
  },
);

GlassSelect.displayName = "GlassSelect";
