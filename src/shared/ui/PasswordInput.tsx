import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import "./PasswordInput.css";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  autoComplete?: string;
  autoFocus?: boolean;
}

export function PasswordInput({
  value,
  onChange,
  id,
  placeholder = "Password",
  inputRef,
  autoComplete = "off",
  autoFocus = false,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="pi-wrapper">
      <input
        ref={inputRef}
        id={id}
        className="pi-input"
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="pi-eye"
        onClick={() => setShow((v) => !v)}
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
