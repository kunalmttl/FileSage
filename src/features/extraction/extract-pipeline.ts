/**
 * Orchestrates text extraction and chunking with bounded concurrency.
 *
 * Optimisations over the naive sequential version:
 *  - Up to CONCURRENCY files processed in parallel (file read + extract + chunk).
 *  - Chunks and file status are written in a single batched DB call per file,
 *    not two separate transactions.
 *  - Progress callbacks are throttled so React re-renders at most every
 *    PROGRESS_INTERVAL_MS, preventing layout thrashing on large vaults.
 */

import { chunkText } from "@/features/extraction/chunker";
import { extractPdfText } from "@/features/extraction/pdf-extractor";
import { extractText } from "@/features/extraction/text-extractor";
import { buildKeywordIndex } from "@/features/retrieval/keyword-index";
import { saveChunksAndUpdateFileStatus } from "@/lib/db/filesage-db";
import type { ChunkRecord, ExtractionStatus, FileEntryRecord } from "@/lib/db/types";

/** Number of files processed in parallel. */
const CONCURRENCY = 4;

/** Minimum ms between progress callback invocations. */
const PROGRESS_INTERVAL_MS = 120;

export type ExtractionProgress = {
  processed: number;
  extracted: number;
  skipped: number;
  chunks: number;
  currentPath?: string;
};

export type ExtractionCallbacks = {
  onProgress?: (progress: ExtractionProgress) => void;
};

export type ExtractionSummary = {
  processed: number;
  extracted: number;
  skipped: number;
  chunks: number;
};

export async function extractAndChunkFiles(
  files: FileEntryRecord[],
  callbacks: ExtractionCallbacks = {}
): Promise<ExtractionSummary> {
  // Shared mutable counters — safe because JS is single-threaded.
  let processed = 0;
  let extracted = 0;
  let skipped = 0;
  let chunks = 0;
  let lastProgressAt = 0;

  function emitProgress(currentPath?: string) {
    const now = Date.now();
    if (!callbacks.onProgress) return;
    if (now - lastProgressAt < PROGRESS_INTERVAL_MS && processed < files.length) return;
    lastProgressAt = now;
    callbacks.onProgress({ processed, extracted, skipped, chunks, currentPath });
  }

  async function processFile(record: FileEntryRecord): Promise<void> {
    let file: File | null = null;

    try {
      if (record.handle) file = await record.handle.getFile();
    } catch {
      // Stale or permission-lost handle — skip silently.
    }

    let status: ExtractionStatus = "skipped";
    let chunkRecords: ChunkRecord[] = [];

    if (file) {
      const isPdf = record.extension.toLowerCase() === "pdf";
      const result = isPdf
        ? await extractPdfText(file)
        : await extractText(file, record.extension);

      if (result) {
        const textChunks = chunkText(result.text);
        chunkRecords = textChunks.map((chunk) => ({
          id: `${record.id}:${chunk.index}`,
          fileId: record.id,
          vaultId: record.vaultId,
          chunkIndex: chunk.index,
          text: chunk.text,
          charStart: chunk.charStart,
          charEnd: chunk.charEnd,
          extractedAt: Date.now(),
        }));
        status = "done";
      }
    }

    // Single transaction: write chunks + update file status together.
    await saveChunksAndUpdateFileStatus(record.id, chunkRecords, status);

    // Build keyword index for this file's chunks (only if we got chunks).
    if (chunkRecords.length > 0) {
      await buildKeywordIndex(chunkRecords, record.vaultId);
    }

    // Update shared counters.
    processed += 1;
    if (status === "done") {
      extracted += 1;
      chunks += chunkRecords.length;
    } else {
      skipped += 1;
    }

    emitProgress(record.relativePath);
  }

  // Run with bounded concurrency via a simple semaphore.
  const queue = [...files];
  const workers = Array.from({ length: Math.min(CONCURRENCY, files.length) }, async () => {
    while (queue.length > 0) {
      const record = queue.shift();
      if (record) await processFile(record);
    }
  });

  await Promise.all(workers);

  // Final progress flush.
  lastProgressAt = 0;
  emitProgress();

  return { processed, extracted, skipped, chunks };
}
