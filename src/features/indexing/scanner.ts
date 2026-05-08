import { getWebkitRelativePath } from "@/features/file-access/picker";
import type { FileEntryRecord, VaultRecord, VaultScanStats } from "@/lib/db/types";
import { recordPipelineTiming } from "@/lib/performance/metrics";

const BATCH_SIZE = 100;

export type ScanProgress = {
  filesScanned: number;
  totalBytes: number;
  currentPath?: string;
};

export type ScanCallbacks = {
  onProgress?: (progress: ScanProgress) => void;
  onBatch?: (files: FileEntryRecord[]) => Promise<void>;
};

export type ScanResult = {
  files: FileEntryRecord[];
  stats: VaultScanStats;
};

export async function scanDirectoryHandleVault(
  vault: VaultRecord,
  callbacks: ScanCallbacks = {}
): Promise<ScanResult> {
  if (!vault.handle) {
    throw new Error("Directory picker vault is missing its root handle.");
  }

  const t0 = performance.now();
  const files: FileEntryRecord[] = [];
  const pendingBatch: FileEntryRecord[] = [];
  const progress: ScanProgress = {
    filesScanned: 0,
    totalBytes: 0,
  };

  async function flushBatch() {
    if (!callbacks.onBatch || pendingBatch.length === 0) {
      return;
    }

    const batch = pendingBatch.splice(0, pendingBatch.length);
    await callbacks.onBatch(batch);
  }

  async function walkDirectory(
    directoryHandle: FileSystemDirectoryHandle,
    pathParts: string[]
  ) {
    for await (const [entryName, handle] of directoryHandle.entries()) {
      const relativePath = [...pathParts, entryName].join("/");

      if (handle.kind === "directory") {
        await walkDirectory(handle, [...pathParts, entryName]);
        continue;
      }

      const file = await handle.getFile();
      const record = createFileEntryRecord({
        vault,
        file,
        relativePath,
        handle,
      });

      files.push(record);
      pendingBatch.push(record);
      progress.filesScanned += 1;
      progress.totalBytes += record.size;
      progress.currentPath = relativePath;
      callbacks.onProgress?.({ ...progress });

      if (pendingBatch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    }
  }

  await walkDirectory(vault.handle, []);
  await flushBatch();

  const scanMs = performance.now() - t0;
  recordPipelineTiming('scan:total', scanMs, { 
    filesFound: progress.filesScanned, 
    totalBytes: progress.totalBytes 
  });

  return {
    files,
    stats: {
      fileCount: progress.filesScanned,
      totalBytes: progress.totalBytes,
      scannedAt: Date.now(),
    },
  };
}

export async function scanUploadedFolderVault(
  vault: VaultRecord,
  fileList: FileList,
  callbacks: ScanCallbacks = {}
): Promise<ScanResult> {
  const t0 = performance.now();
  const files: FileEntryRecord[] = [];
  const pendingBatch: FileEntryRecord[] = [];
  const progress: ScanProgress = {
    filesScanned: 0,
    totalBytes: 0,
  };
  const uploadedFiles = Array.from(fileList);
  const rootName = vault.name;

  async function flushBatch() {
    if (!callbacks.onBatch || pendingBatch.length === 0) {
      return;
    }

    const batch = pendingBatch.splice(0, pendingBatch.length);
    await callbacks.onBatch(batch);
  }

  for (const file of uploadedFiles) {
    const relativePath = normalizeUploadedRelativePath(
      getWebkitRelativePath(file),
      rootName
    );
    const record = createFileEntryRecord({
      vault,
      file,
      relativePath,
    });

    files.push(record);
    pendingBatch.push(record);
    progress.filesScanned += 1;
    progress.totalBytes += record.size;
    progress.currentPath = relativePath;
    callbacks.onProgress?.({ ...progress });

    if (pendingBatch.length >= BATCH_SIZE) {
      await flushBatch();
    }
  }

  await flushBatch();

  const scanMs = performance.now() - t0;
  recordPipelineTiming('scan:total', scanMs, { 
    filesFound: progress.filesScanned, 
    totalBytes: progress.totalBytes 
  });

  return {
    files,
    stats: {
      fileCount: progress.filesScanned,
      totalBytes: progress.totalBytes,
      scannedAt: Date.now(),
    },
  };
}

function createFileEntryRecord({
  vault,
  file,
  relativePath,
  handle,
}: {
  vault: VaultRecord;
  file: File;
  relativePath: string;
  handle?: FileSystemFileHandle;
}): FileEntryRecord {
  return {
    id: `${vault.id}:${relativePath}`,
    vaultId: vault.id,
    name: file.name,
    relativePath,
    size: file.size,
    type: file.type || inferTypeFromExtension(file.name),
    lastModified: file.lastModified,
    extension: getExtension(file.name),
    source: vault.source,
    handle,
  };
}

function normalizeUploadedRelativePath(path: string, rootName: string): string {
  const normalized = path.replaceAll("\\", "/");
  const prefix = `${rootName}/`;

  if (normalized.startsWith(prefix)) {
    return normalized.slice(prefix.length);
  }

  return normalized;
}

function getExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return "";
  }

  return fileName.slice(dotIndex + 1).toLowerCase();
}

function inferTypeFromExtension(fileName: string): string {
  const extension = getExtension(fileName);

  if (!extension) {
    return "application/octet-stream";
  }

  if (["txt", "md", "markdown", "log"].includes(extension)) {
    return "text/plain";
  }

  if (["ts", "tsx", "js", "jsx", "json", "css", "html", "py", "java", "cs"].includes(extension)) {
    return "text/plain";
  }

  if (extension === "pdf") {
    return "application/pdf";
  }

  return "application/octet-stream";
}
