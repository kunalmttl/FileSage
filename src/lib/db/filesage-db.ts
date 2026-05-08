import type {
  ChunkRecord,
  ChunkStatRecord,
  FileEntryRecord,
  FileMetadataQuery,
  FileTypeSummary,
  PostingListRecord,
  PostingRecord,
  TermStatRecord,
  VaultFileStats,
  VaultRecord,
  VaultScanStats,
  VaultStatRecord,
  VectorRecord,
} from "@/lib/db/types";
import { recordPipelineTiming } from "@/lib/performance/metrics";

const DB_NAME = "filesage";
const DB_VERSION = 7;
const VAULT_STORE = "vaults";
const FILE_STORE = "files";
const CHUNK_STORE = "chunks";
const VECTOR_STORE = "vectors";
const POSTING_STORE = "postings";
const TERM_STAT_STORE = "term_stats";
const CHUNK_STAT_STORE = "chunk_stats";
const VAULT_STAT_STORE = "vault_stats";

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

function writeTransaction(
  db: IDBDatabase,
  storeNames: string | string[]
): IDBTransaction {
  return db.transaction(storeNames, "readwrite", { durability: "relaxed" });
}

function commitTransaction(transaction: IDBTransaction): void {
  transaction.commit?.();
}

function ensureIndex(
  store: IDBObjectStore,
  name: string,
  keyPath: string | string[],
  options?: IDBIndexParameters
): void {
  if (!store.indexNames.contains(name)) {
    store.createIndex(name, keyPath, options);
  }
}

function openFilesageDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      if (!db.objectStoreNames.contains(VAULT_STORE)) {
        const vaults = db.createObjectStore(VAULT_STORE, { keyPath: "id" });
        vaults.createIndex("source", "source", { unique: false });
        vaults.createIndex("connectedAt", "connectedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(FILE_STORE)) {
        const files = db.createObjectStore(FILE_STORE, { keyPath: "id" });
        files.createIndex("vaultId", "vaultId", { unique: false });
        files.createIndex("relativePath", "relativePath", { unique: false });
        files.createIndex("extension", "extension", { unique: false });
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

      // v4 — lexical index stores
      if (!db.objectStoreNames.contains(POSTING_STORE)) {
        const postings = db.createObjectStore(POSTING_STORE, { keyPath: "id" });
        postings.createIndex("vaultId_term", ["vaultId", "term"], { unique: false });
        postings.createIndex("chunkId", "chunkId", { unique: false });
        postings.createIndex("vaultId", "vaultId", { unique: false });
      }

      if (!db.objectStoreNames.contains(TERM_STAT_STORE)) {
        const termStats = db.createObjectStore(TERM_STAT_STORE, { keyPath: "id" });
        termStats.createIndex("vaultId", "vaultId", { unique: false });
      }

      if (!db.objectStoreNames.contains(CHUNK_STAT_STORE)) {
        const chunkStats = db.createObjectStore(CHUNK_STAT_STORE, { keyPath: "id" });
        chunkStats.createIndex("vaultId", "vaultId", { unique: false });
      }

      if (!db.objectStoreNames.contains(VAULT_STAT_STORE)) {
        db.createObjectStore(VAULT_STAT_STORE, { keyPath: "id" });
      }

      if (oldVersion < 6) {
        if (db.objectStoreNames.contains(POSTING_STORE)) {
          db.deleteObjectStore(POSTING_STORE);
        }
        const postings = db.createObjectStore(POSTING_STORE, {
          keyPath: ["vaultId", "term"],
        });
        postings.createIndex("vaultId", "vaultId", { unique: false });
      }

      if (oldVersion < 7) {
        const tx = request.transaction;
        if (!tx) return;

        if (db.objectStoreNames.contains(FILE_STORE)) {
          const files = tx.objectStore(FILE_STORE);
          ensureIndex(files, "by_vault_path", ["vaultId", "relativePath"], {
            unique: true,
          });
        }

        if (db.objectStoreNames.contains(CHUNK_STORE)) {
          ensureIndex(tx.objectStore(CHUNK_STORE), "by_file", "fileId", {
            unique: false,
          });
        }

        if (db.objectStoreNames.contains(VECTOR_STORE)) {
          ensureIndex(tx.objectStore(VECTOR_STORE), "by_file", "fileId", {
            unique: false,
          });
        }

        if (db.objectStoreNames.contains(CHUNK_STAT_STORE)) {
          ensureIndex(tx.objectStore(CHUNK_STAT_STORE), "by_file", "fileId", {
            unique: false,
          });
        }
      }
    };

    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        dbPromise = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      reject(
        new Error(
          "FileSage storage upgrade is blocked by another open tab. Close other FileSage tabs and refresh."
        )
      );
    };
  });

  return dbPromise;
}

export async function saveVault(vault: VaultRecord): Promise<void> {
  const db = await openFilesageDb();
  const transaction = db.transaction(VAULT_STORE, "readwrite");
  transaction.objectStore(VAULT_STORE).put(vault);
  await transactionDone(transaction);
}

export async function updateVaultScanStats(vaultId: string, stats: VaultScanStats): Promise<void> {
  const db = await openFilesageDb();
  const transaction = db.transaction(VAULT_STORE, "readwrite");
  const store = transaction.objectStore(VAULT_STORE);
  const vault = await requestToPromise<VaultRecord | undefined>(store.get(vaultId));
  if (!vault) { transaction.abort(); throw new Error(`Vault ${vaultId} not found.`); }
  store.put({ ...vault, fileCount: stats.fileCount, totalBytes: stats.totalBytes, lastScannedAt: stats.scannedAt });
  await transactionDone(transaction);
}

export async function listVaults(): Promise<VaultRecord[]> {
  const db = await openFilesageDb();
  const transaction = db.transaction(VAULT_STORE, "readonly");
  const vaults = await requestToPromise<VaultRecord[]>(transaction.objectStore(VAULT_STORE).getAll());
  await transactionDone(transaction);
  return vaults.sort((a, b) => b.connectedAt - a.connectedAt);
}

export async function deleteVault(vaultId: string): Promise<void> {
  await Promise.all([
    clearFilesForVault(vaultId),
    clearChunksForVault(vaultId),
    clearVectorsForVault(vaultId),
    clearLexicalIndexForVault(vaultId),
  ]);
  const db = await openFilesageDb();
  const tx = db.transaction(VAULT_STORE, "readwrite");
  tx.objectStore(VAULT_STORE).delete(vaultId);
  await transactionDone(tx);
}

export async function getVault(vaultId: string): Promise<VaultRecord | undefined> {
  const db = await openFilesageDb();
  const tx = db.transaction(VAULT_STORE, "readonly");
  const vault = await requestToPromise<VaultRecord | undefined>(tx.objectStore(VAULT_STORE).get(vaultId));
  await transactionDone(tx);
  return vault;
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

export async function clearFilesForVault(vaultId: string): Promise<void> {
  const db = await openFilesageDb();
  const tx = db.transaction(FILE_STORE, "readwrite");
  const req = tx.objectStore(FILE_STORE).index("vaultId").openCursor(IDBKeyRange.only(vaultId));
  await new Promise<void>((resolve, reject) => {
    req.onsuccess = () => {
      try { const c = req.result; if (!c) { resolve(); return; } c.delete(); c.continue(); }
      catch (e) { tx.abort(); reject(e); }
    };
    req.onerror = () => reject(req.error);
  });
  await transactionDone(tx);
}

async function deleteRecordsByIndex(
  storeName: string,
  indexName: string,
  key: IDBValidKey
): Promise<void> {
  const db = await openFilesageDb();
  const tx = writeTransaction(db, storeName);
  const req = tx.objectStore(storeName).index(indexName).openCursor(IDBKeyRange.only(key));

  await new Promise<void>((resolve, reject) => {
    req.onsuccess = () => {
      try {
        const cursor = req.result;
        if (!cursor) {
          resolve();
          return;
        }
        cursor.delete();
        cursor.continue();
      } catch (error) {
        tx.abort();
        reject(error);
      }
    };
    req.onerror = () => reject(req.error);
  });

  await transactionDone(tx);
}

async function listChunkStatsForFile(fileId: string): Promise<ChunkStatRecord[]> {
  const db = await openFilesageDb();
  const tx = db.transaction(CHUNK_STAT_STORE, "readonly");
  const stats = await requestToPromise<ChunkStatRecord[]>(
    tx.objectStore(CHUNK_STAT_STORE).index("by_file").getAll(IDBKeyRange.only(fileId))
  );
  await transactionDone(tx);
  return stats;
}

async function prunePostingsForFile(vaultId: string, fileId: string): Promise<Map<string, number>> {
  const db = await openFilesageDb();
  const readTx = db.transaction(POSTING_STORE, "readonly");
  const records = await requestToPromise<PostingListRecord[]>(
    readTx.objectStore(POSTING_STORE).index("vaultId").getAll(IDBKeyRange.only(vaultId))
  );
  await transactionDone(readTx);

  const updates: PostingListRecord[] = [];
  const deletes: Array<[string, string]> = [];
  const termDeltas = new Map<string, number>();

  for (const record of records) {
    const nextList = record.list.filter((posting) => posting.fileId !== fileId);
    const removed = record.list.length - nextList.length;
    if (removed === 0) continue;
    termDeltas.set(record.term, removed);
    if (nextList.length === 0) {
      deletes.push([record.vaultId, record.term]);
    } else {
      updates.push({ ...record, list: nextList });
    }
  }

  const batchSize = 200;
  for (let i = 0; i < updates.length || i < deletes.length; i += batchSize) {
    const tx = writeTransaction(db, POSTING_STORE);
    const store = tx.objectStore(POSTING_STORE);
    for (const record of updates.slice(i, i + batchSize)) store.put(record);
    for (const key of deletes.slice(i, i + batchSize)) store.delete(key);
    commitTransaction(tx);
    await transactionDone(tx);
  }

  return termDeltas;
}

async function decrementTermStats(vaultId: string, termDeltas: Map<string, number>): Promise<void> {
  if (!termDeltas.size) return;

  const db = await openFilesageDb();
  const entries = Array.from(termDeltas.entries());
  const batchSize = 200;

  for (let i = 0; i < entries.length; i += batchSize) {
    await new Promise<void>((resolve, reject) => {
      const tx = writeTransaction(db, TERM_STAT_STORE);
      const store = tx.objectStore(TERM_STAT_STORE);
      const batch = entries.slice(i, i + batchSize);
      let pending = batch.length;

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);

      for (const [term, delta] of batch) {
        const id = `${vaultId}:${term}`;
        const request = store.get(id);
        request.onsuccess = () => {
          const existing = request.result as TermStatRecord | undefined;
          if (existing) {
            const df = Math.max(0, existing.df - delta);
            if (df > 0) store.put({ ...existing, df });
            else store.delete(id);
          }
          pending -= 1;
          if (pending === 0) commitTransaction(tx);
        };
        request.onerror = () => {
          tx.abort();
          reject(request.error);
        };
      }
    });
  }
}

async function decrementVaultStat(vaultId: string, removedStats: ChunkStatRecord[]): Promise<void> {
  if (!removedStats.length) return;

  const db = await openFilesageDb();
  const tx = writeTransaction(db, VAULT_STAT_STORE);
  const store = tx.objectStore(VAULT_STAT_STORE);
  const existing = await requestToPromise<VaultStatRecord | undefined>(store.get(vaultId));
  if (existing) {
    const removedLength = removedStats.reduce((sum, stat) => sum + stat.tokenCount, 0);
    const currentLength = existing.avgChunkLength * existing.chunkCount;
    const chunkCount = Math.max(0, existing.chunkCount - removedStats.length);
    if (chunkCount > 0) {
      store.put({
        id: vaultId,
        chunkCount,
        avgChunkLength: Math.max(0, currentLength - removedLength) / chunkCount,
      });
    } else {
      store.delete(vaultId);
    }
  }
  await transactionDone(tx);
}

export async function deleteFileAndDependents(file: FileEntryRecord): Promise<void> {
  const removedStats = await listChunkStatsForFile(file.id);
  const termDeltas = await prunePostingsForFile(file.vaultId, file.id);

  await Promise.all([
    deleteRecordsByIndex(CHUNK_STORE, "by_file", file.id),
    deleteRecordsByIndex(VECTOR_STORE, "by_file", file.id),
    deleteRecordsByIndex(CHUNK_STAT_STORE, "by_file", file.id),
    decrementTermStats(file.vaultId, termDeltas),
    decrementVaultStat(file.vaultId, removedStats),
  ]);

  const db = await openFilesageDb();
  const tx = writeTransaction(db, FILE_STORE);
  tx.objectStore(FILE_STORE).delete(file.id);
  commitTransaction(tx);
  await transactionDone(tx);
}

export async function saveFileBatch(files: FileEntryRecord[]): Promise<void> {
  if (!files.length) return;
  const t0 = performance.now();
  const db = await openFilesageDb();
  const tx = writeTransaction(db, FILE_STORE);
  const store = tx.objectStore(FILE_STORE);
  for (const f of files) store.put(f);
  commitTransaction(tx);
  await transactionDone(tx);
  recordPipelineTiming('idb-write:files', performance.now() - t0, { count: files.length });
}

export async function listFilesForVault(vaultId: string): Promise<FileEntryRecord[]> {
  const db = await openFilesageDb();
  const tx = db.transaction(FILE_STORE, "readonly");
  const files = await requestToPromise<FileEntryRecord[]>(
    tx.objectStore(FILE_STORE).index("vaultId").getAll(IDBKeyRange.only(vaultId))
  );
  await transactionDone(tx);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export async function listAllFiles(): Promise<FileEntryRecord[]> {
  const db = await openFilesageDb();
  const tx = db.transaction(FILE_STORE, "readonly");
  const files = await requestToPromise<FileEntryRecord[]>(tx.objectStore(FILE_STORE).getAll());
  await transactionDone(tx);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export async function queryFiles(query: FileMetadataQuery = {}): Promise<FileEntryRecord[]> {
  const files = query.vaultId ? await listFilesForVault(query.vaultId) : await listAllFiles();
  const search = query.search?.trim().toLowerCase();
  const extension = normalizeExtension(query.extension);
  const type = query.type?.trim().toLowerCase();
  const filtered = files.filter((file) => {
    if (extension && file.extension !== extension) return false;
    if (type && file.type.toLowerCase() !== type) return false;
    if (!search) return true;
    return `${file.name} ${file.relativePath} ${file.extension}`.toLowerCase().includes(search);
  });
  return typeof query.limit === "number" ? filtered.slice(0, query.limit) : filtered;
}

export async function listRecentFiles(limit = 10): Promise<FileEntryRecord[]> {
  const files = await listAllFiles();
  return files.toSorted((a, b) => b.lastModified - a.lastModified).slice(0, limit);
}

export async function countFiles(query: FileMetadataQuery = {}): Promise<number> {
  return (await queryFiles(query)).length;
}

export async function getVaultFileStats(vaultId: string): Promise<VaultFileStats> {
  const files = await listFilesForVault(vaultId);
  const extensionCounts: Record<string, number> = {};
  let totalBytes = 0;
  for (const f of files) {
    totalBytes += f.size;
    const ext = f.extension || "no-extension";
    extensionCounts[ext] = (extensionCounts[ext] ?? 0) + 1;
  }
  return { vaultId, fileCount: files.length, totalBytes, extensionCounts };
}

export async function getFileTypeSummary(query: Pick<FileMetadataQuery, "vaultId"> = {}): Promise<FileTypeSummary[]> {
  const files = query.vaultId ? await listFilesForVault(query.vaultId) : await listAllFiles();
  const summary = new Map<string, FileTypeSummary>();
  for (const f of files) {
    const key = f.extension || f.type || "unknown";
    const label = f.extension ? `.${f.extension}` : f.type || "Unknown";
    const ex = summary.get(key);
    if (ex) { ex.count++; ex.totalBytes += f.size; }
    else summary.set(key, { key, label, count: 1, totalBytes: f.size });
  }
  return Array.from(summary.values()).sort((a, b) => b.count - a.count);
}

function normalizeExtension(extension?: string): string | undefined {
  const n = extension?.trim().toLowerCase().replace(/^\./, "");
  return n || undefined;
}

// ---------------------------------------------------------------------------
// Chunk helpers
// ---------------------------------------------------------------------------

export async function clearChunksForVault(vaultId: string): Promise<void> {
  const db = await openFilesageDb();
  const tx = db.transaction(CHUNK_STORE, "readwrite");
  const req = tx.objectStore(CHUNK_STORE).index("vaultId").openCursor(IDBKeyRange.only(vaultId));
  await new Promise<void>((resolve, reject) => {
    req.onsuccess = () => {
      try { const c = req.result; if (!c) { resolve(); return; } c.delete(); c.continue(); }
      catch (e) { tx.abort(); reject(e); }
    };
    req.onerror = () => reject(req.error);
  });
  await transactionDone(tx);
}

export async function listChunksForFile(fileId: string): Promise<ChunkRecord[]> {
  const db = await openFilesageDb();
  const tx = db.transaction(CHUNK_STORE, "readonly");
  const chunks = await requestToPromise<ChunkRecord[]>(
    tx.objectStore(CHUNK_STORE).index("fileId").getAll(IDBKeyRange.only(fileId))
  );
  await transactionDone(tx);
  return chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
}

export async function listChunksForVault(vaultId: string): Promise<ChunkRecord[]> {
  const db = await openFilesageDb();
  const tx = db.transaction(CHUNK_STORE, "readonly");
  const chunks = await requestToPromise<ChunkRecord[]>(
    tx.objectStore(CHUNK_STORE).index("vaultId").getAll(IDBKeyRange.only(vaultId))
  );
  await transactionDone(tx);
  return chunks;
}

export async function listAllChunks(): Promise<ChunkRecord[]> {
  const db = await openFilesageDb();
  const tx = db.transaction(CHUNK_STORE, "readonly");
  const chunks = await requestToPromise<ChunkRecord[]>(
    tx.objectStore(CHUNK_STORE).getAll()
  );
  await transactionDone(tx);
  return chunks;
}

export async function getChunksByIds(chunkIds: string[]): Promise<ChunkRecord[]> {
  if (!chunkIds.length) return [];

  const db = await openFilesageDb();
  const tx = db.transaction(CHUNK_STORE, "readonly");
  const store = tx.objectStore(CHUNK_STORE);
  const chunks = await Promise.all(
    Array.from(new Set(chunkIds)).map((id) =>
      requestToPromise<ChunkRecord | undefined>(store.get(id))
    )
  );
  await transactionDone(tx);
  return chunks.filter((chunk): chunk is ChunkRecord => Boolean(chunk));
}

export async function countChunks(vaultId?: string): Promise<number> {
  const db = await openFilesageDb();
  const tx = db.transaction(CHUNK_STORE, "readonly");
  const store = tx.objectStore(CHUNK_STORE);
  const req = vaultId ? store.index("vaultId").count(IDBKeyRange.only(vaultId)) : store.count();
  const count = await requestToPromise<number>(req);
  await transactionDone(tx);
  return count;
}

export async function updateFileExtractionStatus(
  fileId: string,
  status: import("@/lib/db/types").ExtractionStatus
): Promise<void> {
  const db = await openFilesageDb();
  const tx = db.transaction(FILE_STORE, "readwrite");
  const store = tx.objectStore(FILE_STORE);
  const file = await requestToPromise<FileEntryRecord | undefined>(store.get(fileId));
  if (file) store.put({ ...file, extractionStatus: status });
  await transactionDone(tx);
}

export async function saveChunksAndUpdateFileStatus(
  fileId: string,
  chunks: ChunkRecord[],
  status: import("@/lib/db/types").ExtractionStatus
): Promise<void> {
  const t0 = performance.now();
  const db = await openFilesageDb();
  const batchSize = 50;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const tx = writeTransaction(db, CHUNK_STORE);
    const chunkStore = tx.objectStore(CHUNK_STORE);
    for (const chunk of chunks.slice(i, i + batchSize)) chunkStore.put(chunk);
    commitTransaction(tx);
    await transactionDone(tx);
  }

  const tx = writeTransaction(db, FILE_STORE);
  const fileStore = tx.objectStore(FILE_STORE);
  const file = await requestToPromise<FileEntryRecord | undefined>(fileStore.get(fileId));
  if (file) fileStore.put({ ...file, extractionStatus: status, indexedAt: Date.now() });
  await transactionDone(tx);

  recordPipelineTiming('idb-write:chunks', performance.now() - t0, {
    count: chunks.length,
    batchSize,
  });
}

// ---------------------------------------------------------------------------
// Vector helpers
// ---------------------------------------------------------------------------

export async function saveVectorBatch(vectors: VectorRecord[]): Promise<void> {
  if (!vectors.length) return;
  const t0 = performance.now();
  const db = await openFilesageDb();
  const tx = writeTransaction(db, VECTOR_STORE);
  const store = tx.objectStore(VECTOR_STORE);
  for (const v of vectors) store.put(v);
  commitTransaction(tx);
  await transactionDone(tx);
  recordPipelineTiming('idb-write:vectors', performance.now() - t0, { count: vectors.length });
}

export async function clearVectorsForVault(vaultId: string): Promise<void> {
  const db = await openFilesageDb();
  const tx = db.transaction(VECTOR_STORE, "readwrite");
  const req = tx.objectStore(VECTOR_STORE).index("vaultId").openCursor(IDBKeyRange.only(vaultId));
  await new Promise<void>((resolve, reject) => {
    req.onsuccess = () => {
      try { const c = req.result; if (!c) { resolve(); return; } c.delete(); c.continue(); }
      catch (e) { tx.abort(); reject(e); }
    };
    req.onerror = () => reject(req.error);
  });
  await transactionDone(tx);
}

export async function listAllVectors(vaultId?: string): Promise<VectorRecord[]> {
  const db = await openFilesageDb();
  const tx = db.transaction(VECTOR_STORE, "readonly");
  const req = vaultId
    ? tx.objectStore(VECTOR_STORE).index("vaultId").getAll(IDBKeyRange.only(vaultId))
    : tx.objectStore(VECTOR_STORE).getAll();
  const vectors = await requestToPromise<VectorRecord[]>(req);
  await transactionDone(tx);
  return vectors;
}

export async function countVectors(vaultId?: string): Promise<number> {
  const db = await openFilesageDb();
  const tx = db.transaction(VECTOR_STORE, "readonly");
  const store = tx.objectStore(VECTOR_STORE);
  const req = vaultId ? store.index("vaultId").count(IDBKeyRange.only(vaultId)) : store.count();
  const count = await requestToPromise<number>(req);
  await transactionDone(tx);
  return count;
}

// ---------------------------------------------------------------------------
// Lexical index helpers (v6)
// ---------------------------------------------------------------------------

function savePostingEntryBatch(
  db: IDBDatabase,
  vaultId: string,
  entries: Array<[string, PostingListRecord["list"]]>
): Promise<void> {
  if (!entries.length) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const tx = writeTransaction(db, POSTING_STORE);
    const store = tx.objectStore(POSTING_STORE);
    let pending = entries.length;

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    for (const [term, list] of entries) {
      const request = store.get([vaultId, term]);
      request.onsuccess = () => {
        const existing = request.result as PostingListRecord | undefined;
        store.put({
          vaultId,
          term,
          list: existing ? [...existing.list, ...list] : list,
        });
        pending -= 1;
        if (pending === 0) commitTransaction(tx);
      };
      request.onerror = () => {
        tx.abort();
        reject(request.error);
      };
    }
  });
}

function saveTermStatBatch(
  db: IDBDatabase,
  termStats: TermStatRecord[]
): Promise<void> {
  if (!termStats.length) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const tx = writeTransaction(db, TERM_STAT_STORE);
    const store = tx.objectStore(TERM_STAT_STORE);
    let pending = termStats.length;

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    for (const termStat of termStats) {
      const request = store.get(termStat.id);
      request.onsuccess = () => {
        const existing = request.result as TermStatRecord | undefined;
        store.put({
          ...termStat,
          df: (existing?.df ?? 0) + termStat.df,
        });
        pending -= 1;
        if (pending === 0) commitTransaction(tx);
      };
      request.onerror = () => {
        tx.abort();
        reject(request.error);
      };
    }
  });
}

export async function savePostingBatch(
  postings: PostingRecord[],
  termStats: TermStatRecord[],
  chunkStats: ChunkStatRecord[],
  vaultStat: VaultStatRecord
): Promise<void> {
  if (!postings.length && !chunkStats.length) return;
  const t0 = performance.now();
  const db = await openFilesageDb();
  const postingsByTerm = new Map<string, PostingListRecord["list"]>();
  for (const posting of postings) {
    const list = postingsByTerm.get(posting.term) ?? [];
    list.push({
      chunkId: posting.chunkId,
      fileId: posting.fileId,
      tf: posting.tf,
    });
    postingsByTerm.set(posting.term, list);
  }

  const postingEntries = Array.from(postingsByTerm.entries());
  const postingBatchSize = 200;
  for (let i = 0; i < postingEntries.length; i += postingBatchSize) {
    await savePostingEntryBatch(
      db,
      vaultStat.id,
      postingEntries.slice(i, i + postingBatchSize)
    );
  }

  for (let i = 0; i < termStats.length; i += postingBatchSize) {
    await saveTermStatBatch(db, termStats.slice(i, i + postingBatchSize));
  }

  const chunkStatBatchSize = 50;
  for (let i = 0; i < chunkStats.length; i += chunkStatBatchSize) {
    const tx = writeTransaction(db, CHUNK_STAT_STORE);
    const chunkStatStore = tx.objectStore(CHUNK_STAT_STORE);
    for (const c of chunkStats.slice(i, i + chunkStatBatchSize)) {
      chunkStatStore.put(c);
    }
    commitTransaction(tx);
    await transactionDone(tx);
  }

  const vaultStatTx = writeTransaction(db, VAULT_STAT_STORE);
  const vaultStatStore = vaultStatTx.objectStore(VAULT_STAT_STORE);
  const existingVaultStat = await requestToPromise<VaultStatRecord | undefined>(
    vaultStatStore.get(vaultStat.id)
  );
  if (existingVaultStat) {
    const totalChunks = existingVaultStat.chunkCount + vaultStat.chunkCount;
    const totalLength =
      existingVaultStat.avgChunkLength * existingVaultStat.chunkCount +
      vaultStat.avgChunkLength * vaultStat.chunkCount;

    vaultStatStore.put({
      id: vaultStat.id,
      chunkCount: totalChunks,
      avgChunkLength: totalChunks > 0 ? totalLength / totalChunks : 0,
    });
  } else {
    vaultStatStore.put(vaultStat);
  }

  await transactionDone(vaultStatTx);
  recordPipelineTiming('idb-write:postings', performance.now() - t0, { 
    postingCount: postings.length, 
    termCount: termStats.length,
    chunkStatCount: chunkStats.length,
    postingRecordCount: postingEntries.length,
    postingBatchSize,
    chunkStatBatchSize,
  });
}

export async function getPostingsForTerms(
  vaultId: string,
  terms: string[]
): Promise<Map<string, PostingRecord[]>> {
  const db = await openFilesageDb();
  const tx = db.transaction(POSTING_STORE, "readonly");
  const store = tx.objectStore(POSTING_STORE);
  const result = new Map<string, PostingRecord[]>();

  await Promise.all(
    terms.map(async (term) => {
      const record = await requestToPromise<PostingListRecord | undefined>(
        store.get([vaultId, term])
      );
      const postings: PostingRecord[] =
        record?.list.map((posting) => ({
          id: `${vaultId}:${term}:${posting.chunkId}`,
          vaultId,
          term,
          chunkId: posting.chunkId,
          fileId: posting.fileId,
          tf: posting.tf,
        })) ?? [];
      if (postings.length > 0) result.set(term, postings);
    })
  );

  await transactionDone(tx);
  return result;
}

export async function getTermStats(
  vaultId: string,
  terms: string[]
): Promise<Map<string, TermStatRecord>> {
  const db = await openFilesageDb();
  const tx = db.transaction(TERM_STAT_STORE, "readonly");
  const store = tx.objectStore(TERM_STAT_STORE);
  const result = new Map<string, TermStatRecord>();

  await Promise.all(
    terms.map(async (term) => {
      const id = `${vaultId}:${term}`;
      const stat = await requestToPromise<TermStatRecord | undefined>(store.get(id));
      if (stat) result.set(term, stat);
    })
  );

  await transactionDone(tx);
  return result;
}

export async function getChunkStats(chunkIds: string[]): Promise<Map<string, ChunkStatRecord>> {
  const db = await openFilesageDb();
  const tx = db.transaction(CHUNK_STAT_STORE, "readonly");
  const store = tx.objectStore(CHUNK_STAT_STORE);
  const result = new Map<string, ChunkStatRecord>();

  await Promise.all(
    chunkIds.map(async (id) => {
      const stat = await requestToPromise<ChunkStatRecord | undefined>(store.get(id));
      if (stat) result.set(id, stat);
    })
  );

  await transactionDone(tx);
  return result;
}

export async function getVaultStat(vaultId: string): Promise<VaultStatRecord | undefined> {
  const db = await openFilesageDb();
  const tx = db.transaction(VAULT_STAT_STORE, "readonly");
  const stat = await requestToPromise<VaultStatRecord | undefined>(
    tx.objectStore(VAULT_STAT_STORE).get(vaultId)
  );
  await transactionDone(tx);
  return stat;
}

export async function clearLexicalIndexForVault(vaultId: string): Promise<void> {
  const db = await openFilesageDb();

  // Clear postings
  const txP = db.transaction(POSTING_STORE, "readwrite");
  const reqP = txP.objectStore(POSTING_STORE).index("vaultId").openCursor(IDBKeyRange.only(vaultId));
  await new Promise<void>((resolve, reject) => {
    reqP.onsuccess = () => {
      try { const c = reqP.result; if (!c) { resolve(); return; } c.delete(); c.continue(); }
      catch (e) { txP.abort(); reject(e); }
    };
    reqP.onerror = () => reject(reqP.error);
  });
  await transactionDone(txP);

  // Clear term stats
  const txT = db.transaction(TERM_STAT_STORE, "readwrite");
  const reqT = txT.objectStore(TERM_STAT_STORE).index("vaultId").openCursor(IDBKeyRange.only(vaultId));
  await new Promise<void>((resolve, reject) => {
    reqT.onsuccess = () => {
      try { const c = reqT.result; if (!c) { resolve(); return; } c.delete(); c.continue(); }
      catch (e) { txT.abort(); reject(e); }
    };
    reqT.onerror = () => reject(reqT.error);
  });
  await transactionDone(txT);

  // Clear chunk stats
  const txC = db.transaction(CHUNK_STAT_STORE, "readwrite");
  const reqC = txC.objectStore(CHUNK_STAT_STORE).index("vaultId").openCursor(IDBKeyRange.only(vaultId));
  await new Promise<void>((resolve, reject) => {
    reqC.onsuccess = () => {
      try { const c = reqC.result; if (!c) { resolve(); return; } c.delete(); c.continue(); }
      catch (e) { txC.abort(); reject(e); }
    };
    reqC.onerror = () => reject(reqC.error);
  });
  await transactionDone(txC);

  // Clear vault stat
  const txV = db.transaction(VAULT_STAT_STORE, "readwrite");
  txV.objectStore(VAULT_STAT_STORE).delete(vaultId);
  await transactionDone(txV);
}
