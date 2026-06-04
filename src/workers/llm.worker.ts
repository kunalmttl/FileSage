import {
  MLCEngine,
  prebuiltAppConfig,
  type ChatOptions,
} from "@mlc-ai/web-llm";
import {
  FALLBACK_ASK_MODEL,
  type AskEngine,
  getAskModelOption,
} from "@/features/ask/ask-settings";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type WorkerInbound =
  | { type: "load"; payload: { engine: AskEngine; modelId: string } }
  | {
      type: "generate";
      payload: {
        requestId: string;
        messages: ChatMessage[];
        temperature: number;
        maxTokens: number;
      };
    }
  | { type: "abort" };

type WllamaRuntime = {
  loadModelFromHF: (
    hfOptions: { repo: string; file: string },
    params?: {
      n_ctx?: number;
      n_threads?: number;
      n_gpu_layers?: number;
      useCache?: boolean;
      progressCallback?: (progress: { loaded: number; total: number }) => void;
    }
  ) => Promise<void>;
  createChatCompletion: (options: {
    messages: ChatMessage[];
    stream: true;
    onData: () => void;
    abortSignal?: AbortSignal;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
  }) => Promise<AsyncIterable<{ choices: Array<{ delta?: { content?: string | null } }> }>>;
  exit: () => Promise<void>;
};

const WEBGPU_CHAT_OPTIONS: ChatOptions = {
  context_window_size: 4096,
};

const WEBLLM_MODEL_IDS: Record<string, string> = {
  "webllm-qwen3-0.6b-q4f16": "Qwen3-0.6B-q4f16_1-MLC",
  "webgpu-llama-3.2-1b-q4f16": "Llama-3.2-1B-Instruct-q4f16_1-MLC",
};

let webgpuEngine: MLCEngine | null = null;
let wasmEngine: WllamaRuntime | null = null;
let currentEngine: AskEngine | null = null;
let currentModel = "";
let abortController: AbortController | null = null;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isDeviceLossLikeError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("device") ||
    message.includes("disposed") ||
    message.includes("gpu") ||
    message.includes("oom") ||
    message.includes("out of memory") ||
    message.includes("dxgi_error_device_hung")
  );
}

async function resetEngines(): Promise<void> {
  abortController?.abort();
  abortController = null;

  const previousWebgpu = webgpuEngine;
  const previousWasm = wasmEngine;
  webgpuEngine = null;
  wasmEngine = null;
  currentEngine = null;
  currentModel = "";

  await Promise.allSettled([
    previousWebgpu?.unload(),
    previousWasm?.exit(),
  ]);
}

async function loadWasm(modelId: string): Promise<string> {
  const requested = getAskModelOption(modelId);
  const option =
    requested?.provider === "wllama"
      ? requested
      : getAskModelOption(FALLBACK_ASK_MODEL);
  if (!option?.repo || !option.file) {
    throw new Error("No Wllama model is configured.");
  }

  const workerGlobal = globalThis as unknown as {
    document?: { baseURI: string };
  };
  workerGlobal.document ??= { baseURI: self.location.origin + "/" };

  const { Wllama, LoggerWithoutDebug } = await import("@wllama/wllama/esm/index.js");
  const instance = new Wllama(
    {
      default: "/wllama/wllama.wasm",
    },
    {
      allowOffline: true,
      logger: LoggerWithoutDebug,
      suppressNativeLog: true,
    }
  ) as WllamaRuntime;

  await instance.loadModelFromHF(
    { repo: option.repo, file: option.file },
    {
      n_ctx: 2048,
      n_threads: 1,
      n_gpu_layers: 0,
      useCache: true,
      progressCallback: ({ loaded, total }) => {
        const progress = total > 0 ? loaded / total : 0;
        self.postMessage({
          type: "load_progress",
          progress,
          text: total > 0 ? "Downloading CPU model..." : "Loading CPU model...",
          modelId: option.id,
          engine: "wasm",
        });
      },
    }
  );

  wasmEngine = instance;
  return option.id;
}

async function loadWebgpu(modelId: string): Promise<string> {
  const requested = getAskModelOption(modelId);
  const option =
    requested?.provider === "webllm"
      ? requested
      : getAskModelOption("webllm-qwen3-0.6b-q4f16");
  const webllmModelId = option?.webllmModelId ?? WEBLLM_MODEL_IDS[modelId] ?? modelId;
  console.info("[ask:worker:webllm] load", {
    requested: modelId,
    publicModelId: option?.id ?? modelId,
    webllmModelId,
  });
  const available = new Set(prebuiltAppConfig.model_list.map((model) => model.model_id));
  if (!available.has(webllmModelId)) {
    const qwenFallback = WEBLLM_MODEL_IDS["webllm-qwen3-0.6b-q4f16"];
    const llamaFallback = WEBLLM_MODEL_IDS["webgpu-llama-3.2-1b-q4f16"];
    const fallback = available.has(qwenFallback) ? qwenFallback : llamaFallback;
    if (available.has(fallback)) {
      console.warn("[ask:worker:webllm] Requested model unavailable, falling back", {
        requested: modelId,
        resolved: webllmModelId,
        fallback,
      });
      return loadResolvedWebgpuModel(fallback, option?.id ?? modelId);
    }
    throw new Error(`WebLLM model is not available: ${webllmModelId}`);
  }

  return loadResolvedWebgpuModel(webllmModelId, option?.id ?? modelId);
}

async function loadResolvedWebgpuModel(webllmModelId: string, publicModelId: string): Promise<string> {
  webgpuEngine = new MLCEngine({
    initProgressCallback: (report) => {
      self.postMessage({
        type: "load_progress",
        progress: report.progress ?? 0,
        text: report.text ?? "Loading WebGPU model...",
        modelId: publicModelId,
        engine: "webgpu",
      });
    },
  });
  await webgpuEngine.reload(webllmModelId, WEBGPU_CHAT_OPTIONS);
  return publicModelId;
}

self.onmessage = async (event: MessageEvent<WorkerInbound>) => {
  const message = event.data;

  if (message.type === "load") {
    const { engine, modelId } = message.payload;
    if (currentEngine === engine && currentModel === modelId && (wasmEngine || webgpuEngine)) {
      self.postMessage({ type: "ready", modelId, engine });
      return;
    }

    try {
      await resetEngines();
      const loadedModelId = engine === "wasm" ? await loadWasm(modelId) : await loadWebgpu(modelId);
      currentEngine = engine;
      currentModel = loadedModelId;
      self.postMessage({ type: "ready", modelId: loadedModelId, engine });
    } catch (error) {
      const recoverable = engine === "webgpu" && isDeviceLossLikeError(error);
      await resetEngines();
      self.postMessage({
        type: "load_error",
        message: recoverable
          ? "The WebGPU model crashed. Use the default CPU model instead."
          : errorMessage(error),
        modelId,
        engine,
        recoverable,
        suggestedEngine: "wasm",
        suggestedModelId: FALLBACK_ASK_MODEL,
      });
    }
    return;
  }

  if (message.type === "generate") {
    const { requestId, messages, temperature, maxTokens } = message.payload;
    if (!currentEngine || (!wasmEngine && !webgpuEngine)) {
      self.postMessage({ type: "error", requestId, message: "Local model is not loaded." });
      return;
    }

    try {
      if (currentEngine === "wasm") {
        abortController = new AbortController();
        const stream = await wasmEngine!.createChatCompletion({
          messages,
          stream: true,
          onData: () => {},
          abortSignal: abortController.signal,
          temperature,
          max_tokens: maxTokens,
          top_p: 0.9,
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) self.postMessage({ type: "token", requestId, delta });
        }
        abortController = null;
      } else {
        const stream = await webgpuEngine!.chat.completions.create({
          messages,
          stream: true,
          temperature,
          max_tokens: maxTokens,
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) self.postMessage({ type: "token", requestId, delta });
        }
      }

      self.postMessage({
        type: "done",
        requestId,
        modelId: currentModel,
        engine: currentEngine,
      });
    } catch (error) {
      abortController = null;
      const recoverable = currentEngine === "webgpu" && isDeviceLossLikeError(error);
      if (recoverable) await resetEngines();
      self.postMessage({
        type: "error",
        requestId,
        message: recoverable
          ? "The WebGPU model crashed during generation. Use the default CPU model instead."
          : errorMessage(error),
        recoverable,
        suggestedEngine: "wasm",
        suggestedModelId: FALLBACK_ASK_MODEL,
      });
    }
    return;
  }

  if (message.type === "abort") {
    abortController?.abort();
    abortController = null;
    try {
      await webgpuEngine?.interruptGenerate();
    } catch (error) {
      if (isDeviceLossLikeError(error)) await resetEngines();
    }
    self.postMessage({ type: "aborted", modelId: currentModel, engine: currentEngine });
  }
};
