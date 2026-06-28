import { useState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { PasswordInput } from "@/components/PasswordInput";
import "./PasswordPrompt.css";

interface PasswordPromptProps {
  connectionName: string;
  onSubmit: (password: string) => Promise<void> | void;
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
      await onSubmit(password);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className="pp-overlay" onClick={onCancel} onKeyDown={handleKeyDown}>
      <div className="pp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pp-header">
          <span className="pp-label">Password Required</span>
        </div>
        <form className="pp-form" onSubmit={handleSubmit}>
          <p className="pp-description">
            Enter the password for <strong>{connectionName}</strong>.
          </p>
          <div className="pp-field pp-field--password">
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="Password"
              inputRef={inputRef}
              autoComplete="off"
              autoFocus={true}
            />
          </div>
          <div className="pp-actions">
            <button type="button" className="pp-button pp-button--ghost" onClick={onCancel} disabled={isConnecting}>
              Cancel
            </button>
            <button type="submit" className="pp-button pp-button--primary" disabled={!password || isConnecting}>
              {isConnecting && <Loader2 size={14} className="animate-spin" style={{ marginRight: '6px' }} />}
              {isConnecting ? "Connecting…" : "Connect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
