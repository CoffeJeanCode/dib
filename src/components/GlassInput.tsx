import { forwardRef, type InputHTMLAttributes } from "react";
import "./GlassInput.css";

export type GlassInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="glass-field">
        {label && (
          <label className="glass-label" htmlFor={inputId}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`glass-input ${error ? "glass-input--error" : ""} ${className}`}
          {...props}
        />
        {error && <span className="glass-error">{error}</span>}
      </div>
    );
  },
);

GlassInput.displayName = "GlassInput";
