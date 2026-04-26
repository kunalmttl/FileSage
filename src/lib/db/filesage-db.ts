import type {
  ChunkRecord,
  FileEntryRecord,
  FileMetadataQuery,
  FileTypeSummary,
  VaultFileStats,
  VaultRecord,
  VaultScanStats,
  VectorRecord,
} from "@/lib/db/types";

const DB_NAME = "filesage";
const DB_VERSION = 3;
const VAULT_STORE = "vaults";
const FILE_STORE = "files";
const CHUNK_STORE = "chunks";
const VECTOR_STORE = "vectors";

let dbPromise: Promise<IDBDatabase> | undefined;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function openFilesageDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(VAULT_STORE)) {
        const vaults = db.createObjectStore(VAULT_STORE, { keyPath: "id" });
        vaults.createIndex("source", "source", { unique: false });
        vaults.createIndex("connectedAt", "connectedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(FILE_STORE)) {
        const files = db.createObjectStore(FILE_STORE, { keyPath: "id" });
        files.createIndex("vaultId", "vaultId", { unique: false });
        files.createIndex("relativePath", "relativePath", { unique: false });
        files.createIndex("type", "type", { unique: false });
        files.createIndex("lastModified", "lastModified", { unique: false });
      }

      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const chunks = db.createObjectStore(CHUNK_STORE, { keyPath: "id" });
        chunks.createIndex("fileId", "fileId", { unique: false });
        chunks.createIndex("vaultId", "vaultId", { unique: false });
      }

      if (!db.objectStoreNames.contains(VECTOR_STORE)) {
        const vectors = db.createObjectStore(VECTOR_STORE, { keyPath: "id" });
        vectors.createIndex("fileId", "fileId", { unique: false });
        vectors.createIndex("vaultId", "vaultId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function saveVault(vault: VaultRecord): Promise<void> {
  const db = await openFilesageDb();
  const transaction = db.transaction(VAULT_STORE, "readwrite");
  transaction.objectStore(VAULT_STORE).put(vault);
  await transactionDone(transaction);
}

export async function updateVaultScanStats(
  vaultId: string,
  stats: VaultScanStats
): Promise<void> {
  const db = await openFilesageDb();
  const transaction = db.transaction(VAULT_STORE, "readwrite");
  const store = transaction.objectStore(VAULT_STORE);
  const vault = await requestToPromise<VaultRecord | undefined>(store.get(vaultId));

  if (!vault) {
    transaction.abort();
    throw new Error(`Vault ${vaultId} was not found.`);
  }

  store.put({
    ...vault,
    fileCount: stats.fileCount,
    totalBytes: stats.totalBytes,
    lastScannedAt: stats.scannedAt,
  });
  await transactionDone(transaction);
}

export async function listVaults(): Promise<VaultRecord[]> {
  const db = await openFilesageDb();
  const transaction = db.transaction(VAULT_STORE, "readonly");
  const vaults = await requestToPromise<VaultRecord[]>(
    transaction.objectStore(VAULT_STORE).getAll()
  );
  await transactionDone(transaction);
  return vaults.sort((a, b) => b.connectedAt - a.connectedAt);
}

/**
 * Deletes a vault and all associated files and chunks in three sequential
 * transactions. Runs files and chunks in parallel for speed.
 */
export async function deleteVault(vaultId: string): Promise<void> {
  await Promise.all([
    clearFilesForVault(vaultId),
    clearChunksForVault(vaultId),
  ]);

  const db = await openFilesageDb();
  const transaction = db.transaction(VAULT_STORE, "readwrite");
  transaction.objectStore(VAULT_STORE).delete(vaultId);
  await transactionDone(transaction);
}

export async function getVault(vaultId: string): Promise<VaultRecord | undefined> {
  const db = await openFilesageDb();
  const transaction = db.transaction(VAULT_STORE, "readonly");
  const vault = await requestToPromise<VaultRecord | undefined>(
    transaction.objectStore(VAULT_STORE).get(vaultId)
  );
  await transactionDone(transaction);
  return vault;
}

export async function clearFilesForVault(vaultId: string): Promise<void> {
  const db = await openFilesageDb();
  const transaction = db.transaction(FILE_STORE, "readwrite");
  const index = transaction.objectStore(FILE_STORE).index("vaultId");
  const request = index.openCursor(IDBKeyRange.only(vaultId));

  await new Promise<void>((resolve, reject) => {
    request.onsuccess = () => {
      try {
        const cursor = request.result;

        if (!cursor) {
          resolve();
          return;
        }

        cursor.delete();
        cursor.continue();
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    };
    request.onerror = () => reject(request.error);
  });

  await transactionDone(transaction);
}

export async function saveFileBatch(files: FileEntryRecord[]): Promise<void> {
  if (files.length === 0) {
    return;
  }

  const db = await openFilesageDb();
  const transaction = db.transaction(FILE_STORE, "readwrite");
  const store = transaction.objectStore(FILE_STORE);

  for (const file of files) {
    store.put(file);
  }

  await transactionDone(transaction);
}

export async function listFilesForVault(vaultId: string): Promise<FileEntryRecord[]> {
  const db = await openFilesageDb();
  const transaction = db.transaction(FILE_STORE, "readonly");
  const index = transaction.objectStore(FILE_STORE).index("vaultId");
  const files = await requestToPromise<FileEntryRecord[]>(
    index.getAll(IDBKeyRange.only(vaultId))
  );
  await transactionDone(transaction);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export async function listAllFiles(): Promise<FileEntryRecord[]> {
  const db = await openFilesageDb();
  const transaction = db.transaction(FILE_STORE, "readonly");
  const files = await requestToPromise<FileEntryRecord[]>(
    transaction.objectStore(FILE_STORE).getAll()
  );
  await transactionDone(transaction);
  return sortFilesByPath(files);
}

export async function queryFiles(
  query: FileMetadataQuery = {}
): Promise<FileEntryRecord[]> {
  const files = query.vaultId
    ? await listFilesForVault(query.vaultId)
    : await listAllFiles();
  const search = query.search?.trim().toLowerCase();
  const extension = normalizeExtension(query.extension);
  const type = query.type?.trim().toLowerCase();

  const filtered = files.filter((file) => {
    if (extension && file.extension !== extension) {
      return false;
    }

    if (type && file.type.toLowerCase() !== type) {
      return false;
    }

    if (!search) {
      return true;
    }

    const searchable = `${file.name} ${file.relativePath} ${file.extension} ${file.type}`.toLowerCase();
    return searchable.includes(search);
  });

  return typeof query.limit === "number" ? filtered.slice(0, query.limit) : filtered;
}

export async function listRecentFiles(limit = 10): Promise<FileEntryRecord[]> {
  const files = await listAllFiles();

  return files
    .toSorted((a, b) => b.lastModified - a.lastModified)
    .slice(0, limit);
}

export async function countFiles(query: FileMetadataQuery = {}): Promise<number> {
  const files = await queryFiles(query);
  return files.length;
}

export async function getVaultFileStats(vaultId: string): Promise<VaultFileStats> {
  const files = await listFilesForVault(vaultId);
  const extensionCounts: Record<string, number> = {};
  let totalBytes = 0;

  for (const file of files) {
    totalBytes += file.size;
    const extension = file.extension || "no-extension";
    extensionCounts[extension] = (extensionCounts[extension] || 0) + 1;
  }

  return {
    vaultId,
    fileCount: files.length,
    totalBytes,
    extensionCounts,
  };
}

export async function getFileTypeSummary(
  query: Pick<FileMetadataQuery, "vaultId"> = {}
): Promise<FileTypeSummary[]> {
  const files = query.vaultId
    ? await listFilesForVault(query.vaultId)
    : await listAllFiles();
  const summary = new Map<string, FileTypeSummary>();

  for (const file of files) {
    const key = file.extension || file.type || "unknown";
    const label = file.extension ? `.${file.extension}` : file.type || "Unknown";
    const existing = summary.get(key);

    if (existing) {
      existing.count += 1;
      existing.totalBytes += file.size;
      continue;
    }

    summary.set(key, {
      key,
      label,
      count: 1,
      totalBytes: file.size,
    });
  }

  return Array.from(summary.values()).sort((a, b) => b.count - a.count);
}

function sortFilesByPath(files: FileEntryRecord[]): FileEntryRecord[] {
  return files.toSorted((a, b) => {
    const vaultCompare = a.vaultId.localeCompare(b.vaultId);

    if (vaultCompare !== 0) {
      return vaultCompare;
    }

    return a.relativePath.localeCompare(b.relativePath);
  });
}

function normalizeExtension(extension?: string): string | undefined {
  const normalized = extension?.trim().toLowerCase().replace(/^\./, "");
  return normalized || undefined;
}

// ---------------------------------------------------------------------------
// Chunk helpers
// ---------------------------------------------------------------------------

export async function saveChunkBatch(chunks: ChunkRecord[]): Promise<void> {
  if (chunks.length === 0) return;

  const db = await openFilesageDb();
  const transaction = db.transaction(CHUNK_STORE, "readwrite");
  const store = transaction.objectStore(CHUNK_STORE);

  for (const chunk of chunks) {
    store.put(chunk);
  }

  await transactionDone(transaction);
}

export async function clearChunksForVault(vaultId: string): Promise<void> {
  const db = await openFilesageDb();
  const transaction = db.transaction(CHUNK_STORE, "readwrite");
  const index = transaction.objectStore(CHUNK_STORE).index("vaultId");
  const request = index.openCursor(IDBKeyRange.only(vaultId));

  await new Promise<void>((resolve, reject) => {
    request.onsuccess = () => {
      try {
        const cursor = request.result;
        if (!cursor) { resolve(); return; }
        cursor.delete();
        cursor.continue();
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    };
    request.onerror = () => reject(request.error);
  });

  await transactionDone(transaction);
}

export async function listChunksForFile(fileId: string): Promise<ChunkRecord[]> {
  const db = await openFilesageDb();
  const transaction = db.transaction(CHUNK_STORE, "readonly");
  const index = transaction.objectStore(CHUNK_STORE).index("fileId");
  const chunks = await requestToPromise<ChunkRecord[]>(
    index.getAll(IDBKeyRange.only(fileId))
  );
  await transactionDone(transaction);
  return chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
}

export async function listChunksForVault(vaultId: string): Promise<ChunkRecord[]> {
  const db = await openFilesageDb();
  const transaction = db.transaction(CHUNK_STORE, "readonly");
  const index = transaction.objectStore(CHUNK_STORE).index("vaultId");
  const chunks = await requestToPromise<ChunkRecord[]>(
    index.getAll(IDBKeyRange.only(vaultId))
  );
  await transactionDone(transaction);
  return chunks;
}

export async function countChunks(vaultId?: string): Promise<number> {
  const db = await openFilesageDb();
  const transaction = db.transaction(CHUNK_STORE, "readonly");
  const store = transaction.objectStore(CHUNK_STORE);
  const request = vaultId
    ? store.index("vaultId").count(IDBKeyRange.only(vaultId))
    : store.count();
  const count = await requestToPromise<number>(request);
  await transactionDone(transaction);
  return count;
}

export async function updateFileExtractionStatus(
  fileId: string,
  status: import("@/lib/db/types").ExtractionStatus
): Promise<void> {
  const db = await openFilesageDb();
  const transaction = db.transaction(FILE_STORE, "readwrite");
  const store = transaction.objectStore(FILE_STORE);
  const file = await requestToPromise<FileEntryRecord | undefined>(store.get(fileId));

  if (file) {
    store.put({ ...file, extractionStatus: status });
  }

  await transactionDone(transaction);
}

/**
 * Writes chunk records and updates the file's extractionStatus in a single
 * transaction, avoiding the two-roundtrip cost of separate calls.
 */
export async function saveChunksAndUpdateFileStatus(
  fileId: string,
  chunks: ChunkRecord[],
  status: import("@/lib/db/types").ExtractionStatus
): Promise<void> {
  const db = await openFilesageDb();
  const transaction = db.transaction([FILE_STORE, CHUNK_STORE], "readwrite");
  const fileStore = transaction.objectStore(FILE_STORE);
  const chunkStore = transaction.objectStore(CHUNK_STORE);

  const file = await requestToPromise<FileEntryRecord | undefined>(fileStore.get(fileId));
  if (file) {
    fileStore.put({ ...file, extractionStatus: status });
  }

  for (const chunk of chunks) {
    chunkStore.put(chunk);
  }

  await transactionDone(transaction);
}

// ---------------------------------------------------------------------------
// Vector helpers
// ---------------------------------------------------------------------------

export async function saveVectorBatch(vectors: VectorRecord[]): Promise<void> {
  if (vectors.length === 0) return;

  const db = await openFilesageDb();
  const transaction = db.transaction(VECTOR_STORE, "readwrite");
  const store = transaction.objectStore(VECTOR_STORE);

  for (const v of vectors) {
    store.put(v);
  }

  await transactionDone(transaction);
}

export async function clearVectorsForVault(vaultId: string): Promise<void> {
  const db = await openFilesageDb();
  const transaction = db.transaction(VECTOR_STORE, "readwrite");
  const index = transaction.objectStore(VECTOR_STORE).index("vaultId");
  const request = index.openCursor(IDBKeyRange.only(vaultId));

  await new Promise<void>((resolve, reject) => {
    request.onsuccess = () => {
      try {
        const cursor = request.result;
        if (!cursor) { resolve(); return; }
        cursor.delete();
        cursor.continue();
      } catch (err) {
        transaction.abort();
        reject(err);
      }
    };
    request.onerror = () => reject(request.error);
  });

  await transactionDone(transaction);
}

export async function listAllVectors(vaultId?: string): Promise<VectorRecord[]> {
  const db = await openFilesageDb();
  const transaction = db.transaction(VECTOR_STORE, "readonly");
  const store = transaction.objectStore(VECTOR_STORE);

  const request = vaultId
    ? store.index("vaultId").getAll(IDBKeyRange.only(vaultId))
    : store.getAll();

  const vectors = await requestToPromise<VectorRecord[]>(request);
  await transactionDone(transaction);
  return vectors;
}

export async function countVectors(vaultId?: string): Promise<number> {
  const db = await openFilesageDb();
  const transaction = db.transaction(VECTOR_STORE, "readonly");
  const store = transaction.objectStore(VECTOR_STORE);
  const request = vaultId
    ? store.index("vaultId").count(IDBKeyRange.only(vaultId))
    : store.count();
  const count = await requestToPromise<number>(request);
  await transactionDone(transaction);
  return count;
}
