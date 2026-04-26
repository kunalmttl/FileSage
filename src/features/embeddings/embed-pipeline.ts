/**
 * Embedding pipeline — runs the embedding worker and persists vectors.
 *
 * Design:
 * - Spawns the worker lazily on first call, reuses it for the lifetime of the page.
 * - Sends chunks in batches of BATCH_SIZE to amortise worker message overhead.
 * - Stores normalized vectors in the `vectors` IndexedDB store.
 * - Progress callbacks are throttled (same pattern as extract-pipeline).
 */

import { saveVectorBatch } from "@/lib/db/filesage-db";
import type { ChunkRecord, VectorRecord } from "@/lib/db/types";

const BATCH_SIZE = 32;
const PROGRESS_INTERVAL_MS = 150;

export type EmbedProgress = {
  processed: number;
  total: number;
  stage: "loading" | "embedding" | "done";
  message?: string;
};

export type EmbedCallbacks = {
  onProgress?: (p: EmbedProgress) => void;
};

export type EmbedSummary = {
  embedded: number;
  failed: number;
};

// ---------------------------------------------------------------------------
// Worker singleton
// ---------------------------------------------------------------------------

let workerInstance: Worker | null = null;
let workerReady = false;
let workerReadyPromise: Promise<void> | null = null;

function getWorker(): { worker: Worker; ready: Promise<void> } {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL("@/workers/embedding.worker.ts", import.meta.url),
      { type: "module" }
    );

    workerReadyPromise = new Promise<void>((resolve) => {
      const handler = (e: MessageEvent) => {
        if (e.data?.type === "ready") {
          workerReady = true;
          workerInstance!.removeEventListener("message", handler);
          resolve();
        }
      };
      workerInstance!.addEventListener("message", handler);
    });
  }

  return { worker: workerInstance!, ready: workerReadyPromise! };
}

// ---------------------------------------------------------------------------
// Embed a single batch via the worker
// ---------------------------------------------------------------------------

let requestCounter = 0;

function embedBatch(
  worker: Worker,
  texts: string[]
): Promise<number[][]> {
  return new Promise((resolve, reject) => {
    const id = `embed-${++requestCounter}`;

    const handler = (e: MessageEvent) => {
      const msg = e.data as {
        type: string;
        id: string;
        vectors?: number[][];
        message?: string;
      };

      if (msg.id !== id) return;

      worker.removeEventListener("message", handler);

      if (msg.type === "result" && msg.vectors) {
        resolve(msg.vectors);
      } else if (msg.type === "error") {
        reject(new Error(msg.message ?? "Embedding worker error"));
      }
    };

    worker.addEventListener("message", handler);
    worker.postMessage({ type: "embed", id, texts });
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function embedChunks(
  chunks: ChunkRecord[],
  callbacks: EmbedCallbacks = {}
): Promise<EmbedSummary> {
  if (chunks.length === 0) return { embedded: 0, failed: 0 };

  const { worker, ready } = getWorker();
  let lastProgressAt = 0;

  function emit(p: EmbedProgress) {
    if (!callbacks.onProgress) return;
    const now = Date.now();
    if (now - lastProgressAt < PROGRESS_INTERVAL_MS && p.stage !== "done") return;
    lastProgressAt = now;
    callbacks.onProgress(p);
  }

  emit({ processed: 0, total: chunks.length, stage: "loading", message: "Loading embedding model…" });

  // Forward model-download progress from worker to caller.
  const progressHandler = (e: MessageEvent) => {
    if (e.data?.type === "progress") {
      emit({
        processed: 0,
        total: chunks.length,
        stage: "loading",
        message: e.data.message,
      });
    }
  };
  worker.addEventListener("message", progressHandler);

  await ready;
  worker.removeEventListener("message", progressHandler);

  let processed = 0;
  let failed = 0;

  // Process in batches.
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.text);

    try {
      const vectors = await embedBatch(worker, texts);

      const records: VectorRecord[] = batch.map((chunk, j) => ({
        id: chunk.id,
        fileId: chunk.fileId,
        vaultId: chunk.vaultId,
        vector: vectors[j]!,
        embeddedAt: Date.now(),
      }));

      await saveVectorBatch(records);
      processed += batch.length;
    } catch {
      failed += batch.length;
      processed += batch.length;
    }

    emit({
      processed,
      total: chunks.length,
      stage: "embedding",
      message: `Embedding chunks… ${processed}/${chunks.length}`,
    });
  }

  lastProgressAt = 0;
  emit({ processed, total: chunks.length, stage: "done" });

  return { embedded: processed - failed, failed };
}
