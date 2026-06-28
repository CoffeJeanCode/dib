import { safeInvoke as invoke } from "@/utils/ipc";
import type { UiState } from "@/hooks/useUiState";

export const persistenceService = {
  loadUiState: () =>
    invoke<UiState>("load_ui_state"),

  saveUiState: (state: UiState) =>
    invoke<void>("save_ui_state", { state }),
};
