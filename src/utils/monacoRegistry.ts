import type { OnMount } from "@monaco-editor/react";

type Monaco = Parameters<OnMount>[1];

let monaco: Monaco | null = null;

/** Called from the editor's onMount so cleanup code can reach Monaco. */
export function setMonacoInstance(m: Monaco) {
  monaco = m;
}

/** Dispose every text model — purges the Monaco cache on workspace switch. */
export function disposeAllMonacoModels() {
  if (!monaco) return;
  for (const model of monaco.editor.getModels()) {
    if (!model.isDisposed()) model.dispose();
  }
}
