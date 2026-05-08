export type VaultSource = "directory-picker" | "webkitdirectory";

export type VaultPermissionState = PermissionState | "unsupported";

export type VaultRecord = {
  id: string;
  name: string;
  source: VaultSource;
  connectedAt: number;
  lastScannedAt?: number;
  permissionState: VaultPermissionState;
  fileCount: number;
  totalBytes: number;
  handle?: FileSystemDirectoryHandle;
};

export type FileEntryRecord = {
  id: string;
  vaultId: string;
  name: string;
  relativePath: string;
  size: number;
  type: string;
  lastModified: number;
  extension: string;
  source: VaultSource;
  extractionStatus?: ExtractionStatus;
  handle?: FileSystemFileHandle;
};

export type VaultScanStats = {
  fileCount: number;
  totalBytes: number;
  scannedAt: number;
};

export type FileMetadataQuery = {
  vaultId?: string;
  search?: string;
  extension?: string;
  type?: string;
  limit?: number;
};

export type FileTypeSummary = {
  key: string;
  label: string;
  count: number;
  totalBytes: number;
};

export type VaultFileStats = {
  vaultId: string;
  fileCount: number;
  totalBytes: number;
  extensionCounts: Record<string, number>;
};

export type ExtractionStatus = "pending" | "done" | "skipped" | "error";

export type ChunkRecord = {
  /** `{fileId}:{chunkIndex}` */
  id: string;
  fileId: string;
  vaultId: string;
  chunkIndex: number;
  text: string;
  charStart: number;
  charEnd: number;
  extractedAt: number;
};

export type VectorRecord = {
  /** Same id as ChunkRecord — 1:1 relationship. */
  id: string;
  fileId: string;
  vaultId: string;
  /** Normalized float32 embedding vector. */
  vector: number[];
  embeddedAt: number;
};

// ---------------------------------------------------------------------------
// Lexical index types (DB v4)
// ---------------------------------------------------------------------------

/** One record per (vaultId, term, chunkId). */
export type PostingRecord = {
  /** `{vaultId}:{term}:{chunkId}` */
  id: string;
  vaultId: string;
  term: string;
  chunkId: string;
  fileId: string;
  /** Raw term frequency in this chunk. */
  tf: number;
};

/** One record per (vaultId, term). */
export type TermStatRecord = {
  /** `{vaultId}:{term}` */
  id: string;
  vaultId: string;
  term: string;
  /** Number of chunks containing this term. */
  df: number;
};

/** One record per chunk — stores token count for BM25 length normalization. */
export type ChunkStatRecord = {
  /** Same id as ChunkRecord. */
  id: string;
  vaultId: string;
  fileId: string;
  tokenCount: number;
};

/** One record per vault — stores avg chunk length for BM25. */
export type VaultStatRecord = {
  id: string; // vaultId
  avgChunkLength: number;
  chunkCount: number;
};
