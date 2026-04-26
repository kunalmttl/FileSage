/**
 * Embedding Web Worker
 *
 * Runs @huggingface/transformers (v4) entirely off the main thread.
 * Model: Xenova/all-MiniLM-L6-v2 — 23 MB, 384-dim, good general-purpose embeddings.
 *
 * Message protocol (main -> worker):
 *   { type: "embed", id: string, texts: string[] }
 *
 * Message protocol (worker -> main):
 *   { type: "ready" }
 *   { type: "progress", message: string }
 *   { type: "result", id: string, vectors: number[][] }
 *   { type: "error", id: string, message: string }
 */

import { env, pipeline } from "@huggingface/transformers";

// Browser WASM backend — disable server-side model paths.
env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

type Embedder = Awaited<ReturnType<typeof pipeline>>;
let embedder: Embedder | null = null;

async function getEmbedder(): Promise<Embedder> {
  if (embedder) return embedder;

  embedder = await pipeline("feature-extraction", MODEL_ID, {
    progress_callback: (progress: {
      status: string;
      file?: string;
      progress?: number;
    }) => {
      if (progress.status === "downloading" || progress.status === "initiate") {
        const pct =
          progress.progress != null ? ` ${Math.round(progress.progress)}%` : "";
        self.postMessage({
          type: "progress",
          message: `Downloading model${progress.file ? ` (${progress.file})` : ""}…${pct}`,
        });
      } else if (progress.status === "loading") {
        self.postMessage({ type: "progress", message: "Loading model…" });
      }
    },
  });

  return embedder;
}

/** Normalize a flat Float32Array to unit length, return as number[]. */
function normalizeVector(raw: Float32Array): number[] {
  let sumSq = 0;
  for (let i = 0; i < raw.length; i++) sumSq += raw[i]! * raw[i]!;
  const norm = Math.sqrt(sumSq);
  const out = new Array<number>(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = norm > 0 ? raw[i]! / norm : 0;
  return out;
}

self.onmessage = async (event: MessageEvent) => {
  const msg = event.data as { type: string; id: string; texts: string[] };
  if (msg.type !== "embed") return;

  try {
    const model = await getEmbedder();

    // Batch embed — single forward pass for all texts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output = await (model as any)(msg.texts, {
      pooling: "mean",
      normalize: false,
    });

    const data = output.data as Float32Array;
    const dims = data.length / msg.texts.length;
    const vectors: number[][] = [];

    for (let i = 0; i < msg.texts.length; i++) {
      vectors.push(normalizeVector(data.slice(i * dims, (i + 1) * dims)));
    }

    self.postMessage({ type: "result", id: msg.id, vectors });
  } catch (err) {
    self.postMessage({
      type: "error",
      id: msg.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

// Signal ready immediately after module loads.
self.postMessage({ type: "ready" });
