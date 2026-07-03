import { useState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { PasswordInput } from "@/shared/ui/PasswordInput";
import "@/shared/ui/dialog-shared.css";
import "./PasswordPrompt.css";

interface PasswordPromptProps {
  connectionName: string;
  onSubmit: (password: string) => Promise<boolean | void> | boolean | void;
  onCancel: () => void;
}

export function PasswordPrompt({ connectionName, onSubmit, onCancel }: PasswordPromptProps) {
  const [password, setPassword] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setIsConnecting(true);
    try {
      const success = await onSubmit(password);
      if (success === false) {
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className="dialog-backdrop" onClick={onCancel} onKeyDown={handleKeyDown}>
      <div className="dialog pp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-label">Password Required</span>
        </div>
        <form className="pp-form" onSubmit={handleSubmit}>
          <p className="dialog-message">
            Enter the password for <strong>{connectionName}</strong>.
          </p>
          <div className="pp-field--password">
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="Password"
              inputRef={inputRef}
              autoComplete="off"
              autoFocus={true}
            />
          </div>
          <div className="dialog-actions">
            <button type="button" className="dialog-btn dialog-btn--cancel" onClick={onCancel} disabled={isConnecting}>
              Cancel
            </button>
            <button type="submit" className="dialog-btn dialog-btn--primary" disabled={!password || isConnecting}>
              {isConnecting && <Loader2 size={14} className="animate-spin" style={{ marginRight: '6px' }} />}
              {isConnecting ? "Connecting…" : "Connect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
