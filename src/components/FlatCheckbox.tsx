import { forwardRef, type InputHTMLAttributes } from "react";
import { Check } from "lucide-react";
import "./FlatCheckbox.css";

export type FlatCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

export const FlatCheckbox = forwardRef<HTMLInputElement, FlatCheckboxProps>(
  ({ label, className = "", id, checked, ...props }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

    return (
      <label className={`flat-checkbox ${className}`} htmlFor={inputId}>
        <div className={`flat-checkbox-box${checked ? " flat-checkbox-box--checked" : ""}`}>
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            className="flat-checkbox-input"
            checked={checked}
            {...props}
          />
          {checked && <Check size={12} className="flat-checkbox-tick" />}
        </div>
        <span className="flat-checkbox-label">{label}</span>
      </label>
    );
  },
);

FlatCheckbox.displayName = "FlatCheckbox";
