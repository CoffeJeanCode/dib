import { forwardRef, type InputHTMLAttributes } from "react";
import { Check } from "lucide-react";
import "./GlassCheckbox.css";

export type GlassCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

export const GlassCheckbox = forwardRef<HTMLInputElement, GlassCheckboxProps>(
  ({ label, className = "", id, checked, ...props }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

    return (
      <label className={`glass-checkbox ${className}`} htmlFor={inputId}>
        <div className={`glass-checkbox-box${checked ? " glass-checkbox-box--checked" : ""}`}>
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            className="glass-checkbox-input"
            checked={checked}
            {...props}
          />
          {checked && <Check size={12} className="glass-checkbox-tick" />}
        </div>
        <span className="glass-checkbox-label">{label}</span>
      </label>
    );
  },
);

GlassCheckbox.displayName = "GlassCheckbox";
