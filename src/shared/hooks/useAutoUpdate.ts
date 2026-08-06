import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask } from "@tauri-apps/plugin-dialog";
import { useToastStore } from "@/store/toastStore";

// ponytail: checks once per app launch, no periodic polling — add an interval if silent background checks are wanted later
export function useAutoUpdate() {
  useEffect(() => {
    const toast = useToastStore.getState();

    check()
      .then(async (update) => {
        if (!update) return;

        const install = await ask(
          `Version ${update.version} is available. Install and restart now?`,
          { title: "Update available", kind: "info" },
        );
        if (!install) return;

        toast.info(`Downloading update ${update.version}...`);
        await update.downloadAndInstall();
        toast.success("Update installed. Restarting...");
        await relaunch();
      })
      .catch((err) => {
        console.error("update check failed", err);
      });
  }, []);
}
