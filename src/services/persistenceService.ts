import { invoke } from "@tauri-apps/api/core";

interface UiState {
  is_sidebar_open: boolean;
  save_password: boolean;
  sidebar_width: number;
}

export const persistenceService = {
  loadUiState: () =>
    invoke<UiState>("load_ui_state"),

  saveUiState: (state: UiState) =>
    invoke<void>("save_ui_state", { state }),
};
