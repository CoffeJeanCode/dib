import { safeInvoke as invoke } from "@/shared/utils/ipc";
import type { UiState } from "@/shared/hooks/useUiState";

export const persistenceService = {
  loadUiState: () =>
    invoke<UiState>("load_ui_state"),

  saveUiState: (state: UiState) =>
    invoke<void>("save_ui_state", { state }),
};
