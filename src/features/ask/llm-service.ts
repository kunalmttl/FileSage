import {
  FALLBACK_ASK_MODEL,
  FALLBACK_ASK_PROVIDER,
  type AskProvider,
  providerToWorkerEngine,
} from "@/features/ask/ask-settings";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMStatus =
  | { state: "idle" }
  | { state: "checking-provider"; provider?: AskProvider }
  | {
      state: "loading";
      progress: number;
      text: string;
      modelId?: string;
      provider?: AskProvider;
    }
  | { state: "ready"; modelId: string; provider: AskProvider }
  | { state: "generating"; modelId?: string; provider?: AskProvider }
  | {
      state: "error";
      message: string;
      suggestedModelId?: string;
      suggestedProvider?: AskProvider;
    };

type TokenCallback = (delta: string) => void;
type StatusCallback = (status: LLMStatus) => void;

type PendingRequest = {
  onToken: TokenCallback;
  resolve: () => void;
  reject: (error: Error) => void;
};

type LoadOptions = {
  provider: AskProvider;
  modelId: string;
  openaiBaseUrl?: string;
  openaiApiKey?: string;
};

type GenerateOptions = {
  provider: AskProvider;
  modelId: string;
  openaiBaseUrl?: string;
  openaiApiKey?: string;
  temperature: number;
  maxTokens: number;
  onToken: TokenCallback;
};

type WorkerMessage = {
  type: string;
  requestId?: string;
  delta?: string;
  progress?: number;
  text?: string;
  message?: string;
  modelId?: string;
  engine?: "wasm" | "webgpu";
  recoverable?: boolean;
  suggestedModelId?: string;
  suggestedEngine?: "wasm" | "webgpu";
};

class LLMService {
  private worker: Worker | null = null;
  private statusCallback: StatusCallback | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private currentModel: string | undefined;
  private currentProvider: AskProvider | undefined;
  private routeAbortController: AbortController | null = null;

  init(onStatus: StatusCallback): void {
    this.statusCallback = onStatus;
  }

  async loadModel(options: LoadOptions): Promise<void> {
    console.info("[ask:llm-service] loadModel", {
      provider: options.provider,
      modelId: options.modelId,
      hasOpenAiKey: Boolean(options.openaiApiKey),
    });

    if (options.provider === "ollama") {
      this.statusCallback?.({ state: "checking-provider", provider: "ollama" });
      await this.checkOllama(options.modelId);
      return;
    }

    if (options.provider === "openai") {
      if (!options.openaiApiKey || !options.openaiBaseUrl) {
        this.statusCallback?.({
          state: "error",
          message: "Add an API base URL and key before using the OpenAI-compatible provider.",
        });
        return;
      }
      this.currentProvider = "openai";
      this.currentModel = options.modelId;
      this.statusCallback?.({ state: "ready", provider: "openai", modelId: options.modelId });
      return;
    }

    const engine = providerToWorkerEngine(options.provider);
    if (!engine) return;

    this.ensureWorker();
    this.statusCallback?.({
      state: "loading",
      progress: 0,
      text: options.provider === "wllama" ? "Initializing CPU model..." : "Initializing WebGPU model...",
      modelId: options.modelId,
      provider: options.provider,
    });
    this.worker?.postMessage({ type: "load", payload: { engine, modelId: options.modelId } });
  }

  async generate(messages: ChatMessage[], options: GenerateOptions): Promise<void> {
    console.info("[ask:llm-service] generate", {
      provider: options.provider,
      modelId: options.modelId,
      messages: messages.length,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });

    this.statusCallback?.({
      state: "generating",
      modelId: options.modelId,
      provider: options.provider,
    });

    if (options.provider === "ollama") {
      await this.generateFromRoute("/api/ask/ollama/chat", {
        model: options.modelId,
        messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      }, options.onToken);
      this.statusCallback?.({ state: "ready", provider: "ollama", modelId: options.modelId });
      return;
    }

    if (options.provider === "openai") {
      await this.generateFromRoute("/api/ask/openai-compatible/chat", {
        baseUrl: options.openaiBaseUrl,
        apiKey: options.openaiApiKey,
        model: options.modelId,
        messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      }, options.onToken);
      this.statusCallback?.({ state: "ready", provider: "openai", modelId: options.modelId });
      return;
    }

    return this.generateFromWorker(messages, options);
  }

  abort(): void {
    console.info("[ask:llm-service] abort");
    this.routeAbortController?.abort();
    this.routeAbortController = null;
    this.worker?.postMessage({ type: "abort" });
  }

  private async checkOllama(modelId: string): Promise<void> {
    const startedAt = performance.now();
    try {
      const response = await fetch("/api/ask/ollama/status", { cache: "no-store" });
      const data = (await response.json()) as { ok?: boolean; models?: string[]; message?: string };
      console.info("[ask:llm-service] ollama status", {
        ok: response.ok,
        models: data.models,
        ms: Math.round(performance.now() - startedAt),
      });

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Ollama is not reachable.");
      }

      this.currentProvider = "ollama";
      this.currentModel = modelId;
      const hasModel = (data.models ?? []).some((model) => model === modelId || model.startsWith(`${modelId}:`));
      this.statusCallback?.({
        state: "ready",
        provider: "ollama",
        modelId: hasModel ? modelId : `${modelId} (pull if missing)`,
      });
    } catch (error) {
      console.warn("[ask:llm-service] ollama status failed", error);
      this.currentProvider = undefined;
      this.currentModel = undefined;
      this.statusCallback?.({
        state: "error",
        message: "Ollama is not reachable. Start Ollama and pull the selected model.",
        suggestedProvider: FALLBACK_ASK_PROVIDER,
        suggestedModelId: FALLBACK_ASK_MODEL,
      });
    }
  }

  private async generateFromRoute(
    url: string,
    body: Record<string, unknown>,
    onToken: TokenCallback
  ): Promise<void> {
    const startedAt = performance.now();
    this.routeAbortController = new AbortController();
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: this.routeAbortController.signal,
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      console.warn("[ask:llm-service] route generation failed", {
        url,
        status: response.status,
        errorText,
      });
      throw new Error(parseErrorMessage(errorText) || `Generation failed with ${response.status}`);
    }

    let chars = 0;
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          chars += value.length;
          onToken(value);
        }
      }
    } finally {
      this.routeAbortController = null;
      console.info("[ask:llm-service] route generation done", {
        url,
        chars,
        ms: Math.round(performance.now() - startedAt),
      });
    }
  }

  private generateFromWorker(messages: ChatMessage[], options: GenerateOptions): Promise<void> {
    this.ensureWorker();
    const requestId = crypto.randomUUID();
    const promise = new Promise<void>((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        onToken: options.onToken,
        resolve,
        reject,
      });
    });

    this.worker?.postMessage({
      type: "generate",
      payload: {
        requestId,
        messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      },
    });

    return promise;
  }

  private ensureWorker(): void {
    if (!this.worker) this.createWorker();
  }

  private createWorker(): void {
    this.worker = new Worker(new URL("../../workers/llm.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = this.handleMessage;
    this.worker.onerror = (event) => {
      const detail = event.message ? ` ${event.message}` : "";
      this.resetWorker(new Error(`The browser model worker crashed.${detail}`));
      this.statusCallback?.({
        state: "error",
        message: `The browser model worker crashed.${detail}`,
        suggestedProvider: "ollama",
        suggestedModelId: "gemma3:1b",
      });
    };
  }

  private resetWorker(error?: Error): void {
    this.worker?.terminate();
    this.worker = null;
    this.currentModel = undefined;
    this.currentProvider = undefined;

    if (error) {
      for (const request of this.pendingRequests.values()) {
        request.reject(error);
      }
    }
    this.pendingRequests.clear();
  }

  private handleMessage = (event: MessageEvent<WorkerMessage>) => {
    const {
      type,
      requestId,
      delta,
      progress,
      text,
      message,
      modelId,
      engine,
      recoverable,
      suggestedModelId,
      suggestedEngine,
    } = event.data;

    const provider = engine === "webgpu" ? "webllm" : engine === "wasm" ? "wllama" : this.currentProvider;

    if (type === "load_progress") {
      this.statusCallback?.({
        state: "loading",
        progress: progress ?? 0,
        text: text ?? "Loading browser model...",
        modelId,
        provider,
      });
      return;
    }

    if (type === "ready" && provider) {
      this.currentModel = modelId;
      this.currentProvider = provider;
      this.statusCallback?.({
        state: "ready",
        modelId: modelId ?? "unknown",
        provider,
      });
      return;
    }

    if (type === "load_error") {
      if (recoverable) this.resetWorker();
      this.statusCallback?.({
        state: "error",
        message: message ?? "Browser model load failed.",
        suggestedModelId: suggestedModelId ?? FALLBACK_ASK_MODEL,
        suggestedProvider: suggestedEngine === "webgpu" ? "webllm" : "wllama",
      });
      return;
    }

    if (type === "token" && requestId && delta) {
      this.pendingRequests.get(requestId)?.onToken(delta);
      return;
    }

    if (type === "done" && requestId) {
      const request = this.pendingRequests.get(requestId);
      request?.resolve();
      this.pendingRequests.delete(requestId);
      this.currentModel = modelId ?? this.currentModel;
      this.currentProvider = provider ?? this.currentProvider;
      this.statusCallback?.({
        state: "ready",
        modelId: this.currentModel ?? "unknown",
        provider: this.currentProvider ?? "wllama",
      });
      return;
    }

    if (type === "aborted") {
      this.statusCallback?.({
        state: "ready",
        modelId: modelId ?? this.currentModel ?? "unknown",
        provider: provider ?? this.currentProvider ?? "wllama",
      });
      return;
    }

    if (type === "error" && requestId) {
      const request = this.pendingRequests.get(requestId);
      const error = new Error(message ?? "Generation failed.");
      request?.reject(error);
      this.pendingRequests.delete(requestId);
      if (recoverable) this.resetWorker();
      this.statusCallback?.({
        state: "error",
        message: message ?? "Generation failed.",
        suggestedModelId: suggestedModelId ?? FALLBACK_ASK_MODEL,
        suggestedProvider: suggestedEngine === "webgpu" ? "webllm" : "wllama",
      });
    }
  };
}

function parseErrorMessage(text: string): string {
  try {
    const parsed = JSON.parse(text) as { message?: string; error?: string };
    return parsed.message ?? parsed.error ?? text;
  } catch {
    return text;
  }
}

export const llmService = new LLMService();
