import { forwardRef, type InputHTMLAttributes } from "react";
import "./FlatSwitch.css";

export type FlatSwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  description?: string;
};

export const FlatSwitch = forwardRef<HTMLInputElement, FlatSwitchProps>(
  ({ label, description, className = "", id, checked, ...props }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

    return (
      <label className={`flat-switch ${className}`} htmlFor={inputId}>
        <div className="flat-switch-text">
          <span className="flat-switch-label">{label}</span>
          {description ? (
            <span className="flat-switch-desc">{description}</span>
          ) : null}
        </div>
        <div className={`flat-switch-track${checked ? " flat-switch-track--on" : ""}`}>
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            role="switch"
            className="flat-switch-input"
            checked={checked}
            aria-checked={!!checked}
            {...props}
          />
          <span className="flat-switch-thumb" />
        </div>
      </label>
    );
  },
);

FlatSwitch.displayName = "FlatSwitch";
