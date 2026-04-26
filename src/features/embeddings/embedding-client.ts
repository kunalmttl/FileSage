/**
 * Main-thread client for the embedding Web Worker.
 *
 * - Lazily creates the worker on first use.
 * - Queues embed requests with unique IDs and resolves them when the worker replies.
 * - Exposes a simple `embedBatch(texts)` API that returns normalized vectors.
 */

type WorkerMessage =
  | { type: "ready" }
  | { type: "progress"; message: string }
  | { type: "result"; id: string; vectors: number[][] }
  | { type: "error"; id: string; message: string };

type PendingRequest = {
  resolve: (vectors: number[][]) => void;
  reject: (err: Error) => void;
};

let worker: Worker | null = null;
let workerReady = false;
const pending = new Map<string, PendingRequest>();
const readyCallbacks: Array<() => void> = [];
let idCounter = 0;

export type EmbeddingProgress = {
  message: string;
};

let progressCallback: ((p: EmbeddingProgress) => void) | null = null;

export function setEmbeddingProgressCallback(
  cb: ((p: EmbeddingProgress) => void) | null
): void {
  progressCallback = cb;
}

function getWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(
    new URL("@/workers/embedding.worker.ts", import.meta.url),
    { type: "module" }
  );

  worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const msg = event.data;

    if (msg.type === "ready") {
      workerReady = true;
      for (const cb of readyCallbacks) cb();
      readyCallbacks.length = 0;
      return;
    }

    if (msg.type === "progress") {
      progressCallback?.({ message: msg.message });
      return;
    }

    if (msg.type === "result") {
      pending.get(msg.id)?.resolve(msg.vectors);
      pending.delete(msg.id);
      return;
    }

    if (msg.type === "error") {
      pending.get(msg.id)?.reject(new Error(msg.message));
      pending.delete(msg.id);
    }
  };

  worker.onerror = (err) => {
    const error = new Error(err.message ?? "Embedding worker crashed");
    for (const req of pending.values()) req.reject(error);
    pending.clear();
    worker = null;
    workerReady = false;
  };

  return worker;
}

function waitForReady(): Promise<void> {
  if (workerReady) return Promise.resolve();
  return new Promise((resolve) => readyCallbacks.push(resolve));
}

/**
 * Embeds a batch of texts. Initialises the worker on first call (triggers model download).
 * Returns one normalized float32 vector per input text.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const w = getWorker();
  await waitForReady();

  const id = String(++idCounter);

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ type: "embed", id, texts });
  });
}

/** Terminate the worker (e.g. on page unload or settings reset). */
export function terminateEmbeddingWorker(): void {
  worker?.terminate();
  worker = null;
  workerReady = false;
  pending.clear();
}
