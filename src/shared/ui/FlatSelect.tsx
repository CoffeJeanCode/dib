import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import "./FlatSelect.css";

export type FlatSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
};

export const FlatSelect = forwardRef<HTMLSelectElement, FlatSelectProps>(
  ({ label, error, className = "", id, children, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flat-field">
        {label && (
          <label className="flat-label" htmlFor={selectId}>
            {label}
          </label>
        )}
        <div className="flat-select-wrapper">
          <select
            ref={ref}
            id={selectId}
            className={`flat-select ${error ? "flat-select--error" : ""} ${className}`}
            {...props}
          >
            {children}
          </select>
          <ChevronDown size={14} className="flat-select-arrow" aria-hidden />
        </div>
        {error && <span className="flat-error">{error}</span>}
      </div>
    );
  },
);

FlatSelect.displayName = "FlatSelect";
