import type { VaultRecord } from "@/lib/db/types";
import type { DirectoryPickerWindow } from "@/features/file-access/types";

export function canUseDirectoryPicker(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function";
}

export async function pickDirectoryVault(): Promise<VaultRecord> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;

  if (!picker) {
    throw new Error("This browser does not support showDirectoryPicker().");
  }

  const handle = await picker({
    id: "filesage-vault",
    mode: "read",
  });
  const permissionState = await queryDirectoryReadPermission(handle);

  return {
    id: crypto.randomUUID(),
    name: handle.name,
    source: "directory-picker",
    connectedAt: Date.now(),
    permissionState,
    fileCount: 0,
    totalBytes: 0,
    handle,
  };
}

export async function queryDirectoryReadPermission(
  handle: FileSystemDirectoryHandle
): Promise<PermissionState> {
  return handle.queryPermission({ mode: "read" });
}

export async function requestDirectoryReadPermission(
  handle: FileSystemDirectoryHandle
): Promise<PermissionState> {
  const currentPermission = await queryDirectoryReadPermission(handle);

  if (currentPermission === "granted") {
    return currentPermission;
  }

  return handle.requestPermission({ mode: "read" });
}

export function createUploadFallbackVault(files: FileList): VaultRecord {
  const firstFile = files.item(0);
  const firstPath = firstFile ? getWebkitRelativePath(firstFile) : "";
  const [rootName] = firstPath.split("/");

  return {
    id: crypto.randomUUID(),
    name: rootName || "Uploaded folder",
    source: "webkitdirectory",
    connectedAt: Date.now(),
    permissionState: "unsupported",
    fileCount: 0,
    totalBytes: 0,
  };
}

export function getWebkitRelativePath(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}
