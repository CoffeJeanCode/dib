import { useState, useRef, useEffect } from "react";
import "./PasswordPrompt.css";

interface PasswordPromptProps {
  connectionName: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

export function PasswordPrompt({ connectionName, onSubmit, onCancel }: PasswordPromptProps) {
  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) onSubmit(password);
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
          <div className="pp-field">
            <input
              ref={inputRef}
              className="pp-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="off"
            />
          </div>
          <div className="pp-actions">
            <button type="button" className="pp-button pp-button--ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="pp-button pp-button--primary" disabled={!password}>
              Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
