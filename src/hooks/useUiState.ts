import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface UiState {
  is_sidebar_open: boolean;
  save_password: boolean;
  sidebar_width: number;
}

const DEFAULT_STATE: UiState = {
  is_sidebar_open: true,
  save_password: true,
  sidebar_width: 260,
};

export function useUiState() {
  const [state, setState] = useState<UiState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    invoke<UiState>("load_ui_state")
      .then((saved) => {
        setState({ ...DEFAULT_STATE, ...saved });
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, []);

  const updateState = useCallback(
    (patch: Partial<UiState>) => {
      const next = { ...state, ...patch };
      setState(next);
      invoke("save_ui_state", { state: next }).catch(() => {});
    },
    [state],
  );

  const toggleSidebar = useCallback(() => {
    updateState({ is_sidebar_open: !state.is_sidebar_open });
  }, [state.is_sidebar_open, updateState]);

  return { state, loaded, updateState, toggleSidebar };
}
