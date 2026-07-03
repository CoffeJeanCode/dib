import { forwardRef, type InputHTMLAttributes } from "react";
import "./FlatInput.css";

export type FlatInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const FlatInput = forwardRef<HTMLInputElement, FlatInputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flat-field">
        {label && (
          <label className="flat-label" htmlFor={inputId}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`flat-input ${error ? "flat-input--error" : ""} ${className}`}
          {...props}
        />
        {error && <span className="flat-error">{error}</span>}
      </div>
    );
  },
);

FlatInput.displayName = "FlatInput";
