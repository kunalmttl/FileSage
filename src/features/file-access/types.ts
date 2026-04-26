import type { FileEntryRecord, VaultRecord } from "@/lib/db/types";

export type DirectoryPickerWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: (options?: {
      id?: string;
      mode?: "read" | "readwrite";
      startIn?: string;
    }) => Promise<FileSystemDirectoryHandle>;
  };

export type VaultConnectionResult = {
  vault: VaultRecord;
  files: FileEntryRecord[];
};
