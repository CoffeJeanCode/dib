import { workspaceService } from "@/services/workspaceService";
import type { FsNode } from "@/types/workspace";

/**
 * One-shot migrations that collapse legacy internal scripts (rusqlite) into
 * the mode-native store, so "script" means exactly one thing per mode:
 * workspace → .sql file on disk, standalone → virtual script per connection.
 *
 * Both are idempotent: once internal_scripts is empty they no-op.
 */

function fileNameFor(title: string): string {
  return title.includes(".") ? title : `${title}.sql`;
}

function collectFileNames(tree: FsNode | null): Set<string> {
  const names = new Set<string>();
  const walk = (n: FsNode) => {
    if (n.isDir || n.is_dir) (n.children ?? []).forEach(walk);
    else names.add(n.name.toLowerCase());
  };
  if (tree) (tree.children ?? []).forEach(walk);
  return names;
}

/** Exports internal scripts as .sql files in the workspace root, then deletes
 *  them from the DB. Name collisions are skipped (script stays internal and
 *  visible via the internalScripts list). Returns how many files were written. */
export async function migrateInternalToWorkspace(rootPath: string, tree: FsNode | null): Promise<number> {
  const scripts = await workspaceService.getInternalScripts().catch(() => []);
  if (scripts.length === 0) return 0;
  const existing = collectFileNames(tree);
  const root = rootPath.replace(/\\/g, "/").replace(/\/$/, "");
  let migrated = 0;
  for (const s of scripts) {
    const fileName = fileNameFor(s.title);
    if (existing.has(fileName.toLowerCase())) continue;
    try {
      await workspaceService.writeTextFile(`${root}/${fileName}`, s.content);
      await workspaceService.deleteInternalScript(s.id);
      existing.add(fileName.toLowerCase());
      migrated++;
    } catch (e) {
      console.error("[DIB] internal→workspace migration failed for", s.title, e);
    }
  }
  return migrated;
}

/** Moves internal scripts into virtual_scripts under the given STABLE
 *  saved-connection id, then deletes them from the DB. */
export async function migrateInternalToVirtual(savedConnectionId: string): Promise<number> {
  const scripts = await workspaceService.getInternalScripts().catch(() => []);
  let migrated = 0;
  for (const s of scripts) {
    try {
      await workspaceService.saveVirtualScript(s.id, fileNameFor(s.title), s.content, null, savedConnectionId);
      await workspaceService.deleteInternalScript(s.id);
      migrated++;
    } catch (e) {
      console.error("[DIB] internal→virtual migration failed for", s.title, e);
    }
  }
  return migrated;
}
