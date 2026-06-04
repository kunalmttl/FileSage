export const ASK_SETTINGS_KEY = "filesage:ask-settings";
const ASK_SETTINGS_VERSION = 6;

export type AskProvider = "ollama" | "webllm" | "wllama" | "openai";
export type AskEngine = "wasm" | "webgpu";

export const DEFAULT_ASK_PROVIDER: AskProvider = "ollama";
export const DEFAULT_ASK_MODEL = "gemma3:1b";
export const FALLBACK_ASK_PROVIDER: AskProvider = "wllama";
export const FALLBACK_ASK_MODEL = "qwen3-0.6b-q4-k-m";

export const ASK_CONTEXT_MIN = 1;
export const ASK_CONTEXT_MAX = 8;
export const ASK_RESPONSE_MIN = 128;
export const ASK_RESPONSE_MAX = 1024;

export type AskModelOption = {
  id: string;
  provider: AskProvider;
  label: string;
  description: string;
  repo?: string;
  file?: string;
  webllmModelId?: string;
};

export const ASK_MODEL_OPTIONS: AskModelOption[] = [
  {
    id: DEFAULT_ASK_MODEL,
    provider: "ollama",
    label: "Gemma 3 1B",
    description: "Recommended local Ollama model for private RAG answers",
  },
  {
    id: "qwen3:0.6b",
    provider: "ollama",
    label: "Qwen3 0.6B",
    description: "Tiny Ollama fallback with /no_think support",
  },
  {
    id: "qwen2.5:3b-instruct",
    provider: "ollama",
    label: "Qwen2.5 3B Instruct",
    description: "Better Ollama quality on stronger machines",
  },
  {
    id: "qwen2.5:7b-instruct",
    provider: "ollama",
    label: "Qwen2.5 7B Instruct",
    description: "Highest local quality option for machines with enough RAM",
  },
  {
    id: "webllm-qwen3-0.6b-q4f16",
    provider: "webllm",
    label: "Qwen3 0.6B q4f16",
    description: "Browser WebGPU model with /no_think support",
    webllmModelId: "Qwen3-0.6B-q4f16_1-MLC",
  },
  {
    id: "webgpu-llama-3.2-1b-q4f16",
    provider: "webllm",
    label: "Llama 3.2 1B q4f16",
    description: "Experimental browser WebGPU fallback",
    webllmModelId: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  },
  {
    id: FALLBACK_ASK_MODEL,
    provider: "wllama",
    label: "Qwen3 0.6B Q4_K_M",
    description: "Universal CPU/WASM fallback, slower but local",
    repo: "Qwen/Qwen3-0.6B-GGUF",
    file: "Qwen3-0.6B-Q4_K_M.gguf",
  },
  {
    id: "qwen2.5-0.5b-q4-k-m",
    provider: "wllama",
    label: "Qwen2.5 0.5B Q4_K_M",
    description: "Legacy CPU/WASM model",
    repo: "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
    file: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    provider: "openai",
    label: "OpenRouter Llama 3.3 70B Free",
    description: "Optional BYOK cloud model; retrieved chunks leave this device",
  },
] as const;

const ASK_MODEL_IDS = new Set<string>(ASK_MODEL_OPTIONS.map((model) => model.id));

const LEGACY_MODEL_MIGRATIONS = new Map<string, { provider: AskProvider; modelId: string }>([
  ["qwen2.5-0.5b-q4-k-m", { provider: "wllama", modelId: "qwen2.5-0.5b-q4-k-m" }],
  ["qwen2.5-0.5b-q3-k-m", { provider: "wllama", modelId: "qwen2.5-0.5b-q4-k-m" }],
  ["Llama-3.2-1B-Instruct-q4f16_1-MLC", { provider: "webllm", modelId: "webgpu-llama-3.2-1b-q4f16" }],
  ["Llama-3.2-1B-Instruct-q4f32_1-MLC", { provider: "webllm", modelId: "webgpu-llama-3.2-1b-q4f16" }],
  ["Phi-3.5-mini-instruct-q4f16_1-MLC", { provider: "ollama", modelId: DEFAULT_ASK_MODEL }],
  ["Phi-3.5-mini-instruct-q4f32_1-MLC", { provider: "ollama", modelId: DEFAULT_ASK_MODEL }],
  ["SmolLM2-360M-Instruct-q4f32_1-MLC", { provider: "ollama", modelId: DEFAULT_ASK_MODEL }],
]);

export type AskSettings = {
  version?: number;
  provider: AskProvider;
  modelId: string;
  contextChunks: number;
  maxResponseTokens: number;
  temperature: number;
  openaiBaseUrl: string;
  openaiApiKey: string;
};

type LegacyAskSettings = Partial<AskSettings> & {
  engine?: AskEngine;
};

export const DEFAULT_ASK_SETTINGS: AskSettings = {
  version: ASK_SETTINGS_VERSION,
  provider: DEFAULT_ASK_PROVIDER,
  modelId: DEFAULT_ASK_MODEL,
  contextChunks: 5,
  maxResponseTokens: 512,
  temperature: 0.1,
  openaiBaseUrl: "https://openrouter.ai/api/v1",
  openaiApiKey: "",
};

export function getDefaultModelForProvider(provider: AskProvider): string {
  return ASK_MODEL_OPTIONS.find((model) => model.provider === provider)?.id ?? DEFAULT_ASK_MODEL;
}

export function getDefaultModelForEngine(engine: AskEngine): string {
  return getDefaultModelForProvider(engine === "webgpu" ? "webllm" : "wllama");
}

export function getAskModelOption(modelId: string): AskModelOption | undefined {
  return ASK_MODEL_OPTIONS.find((model) => model.id === modelId);
}

export function getProviderLabel(provider: AskProvider): string {
  switch (provider) {
    case "ollama":
      return "Ollama local";
    case "webllm":
      return "Browser WebGPU";
    case "wllama":
      return "Browser CPU";
    case "openai":
      return "OpenAI-compatible API";
  }
}

export function isBrowserProvider(provider: AskProvider): boolean {
  return provider === "webllm" || provider === "wllama";
}

export function providerToWorkerEngine(provider: AskProvider): AskEngine | undefined {
  if (provider === "webllm") return "webgpu";
  if (provider === "wllama") return "wasm";
  return undefined;
}

export function clampAskSettings(settings: LegacyAskSettings): AskSettings {
  const migrated = migrateLegacySettings(settings);
  const provider = isAskProvider(migrated.provider) ? migrated.provider : DEFAULT_ASK_PROVIDER;
  const requestedModel = migrated.modelId || getDefaultModelForProvider(provider);
  const option = getAskModelOption(requestedModel);
  const modelId =
    !ASK_MODEL_IDS.has(requestedModel) || option?.provider !== provider
      ? getDefaultModelForProvider(provider)
      : requestedModel;

  return {
    version: ASK_SETTINGS_VERSION,
    provider,
    modelId,
    contextChunks: clampNumber(
      migrated.contextChunks,
      ASK_CONTEXT_MIN,
      ASK_CONTEXT_MAX,
      DEFAULT_ASK_SETTINGS.contextChunks
    ),
    maxResponseTokens: clampNumber(
      migrated.maxResponseTokens,
      ASK_RESPONSE_MIN,
      ASK_RESPONSE_MAX,
      DEFAULT_ASK_SETTINGS.maxResponseTokens
    ),
    temperature: clampNumber(migrated.temperature, 0, 1, DEFAULT_ASK_SETTINGS.temperature),
    openaiBaseUrl: sanitizeBaseUrl(migrated.openaiBaseUrl ?? DEFAULT_ASK_SETTINGS.openaiBaseUrl),
    openaiApiKey: typeof migrated.openaiApiKey === "string" ? migrated.openaiApiKey : "",
  };
}

export function loadAskSettings(): AskSettings {
  if (typeof window === "undefined") return DEFAULT_ASK_SETTINGS;

  try {
    const raw = window.localStorage.getItem(ASK_SETTINGS_KEY);
    if (!raw) return DEFAULT_ASK_SETTINGS;
    const next = clampAskSettings(JSON.parse(raw) as LegacyAskSettings);
    window.localStorage.setItem(ASK_SETTINGS_KEY, JSON.stringify(next));
    return next;
  } catch {
    return DEFAULT_ASK_SETTINGS;
  }
}

export function saveAskSettings(settings: AskSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ASK_SETTINGS_KEY, JSON.stringify(clampAskSettings(settings)));
  window.dispatchEvent(new CustomEvent("filesage:ask-settings"));
}

function migrateLegacySettings(settings: LegacyAskSettings): LegacyAskSettings {
  if (settings.version === ASK_SETTINGS_VERSION) return settings;
  if (settings.provider && settings.modelId) {
    const option = getAskModelOption(settings.modelId);
    if (option?.provider === settings.provider) return settings;
    return {
      ...settings,
      modelId: getDefaultModelForProvider(
        isAskProvider(settings.provider) ? settings.provider : DEFAULT_ASK_PROVIDER
      ),
    };
  }
  if (settings.modelId && LEGACY_MODEL_MIGRATIONS.has(settings.modelId)) {
    return { ...settings, ...LEGACY_MODEL_MIGRATIONS.get(settings.modelId)! };
  }
  if (settings.engine === "webgpu") {
    return { ...settings, provider: "webllm", modelId: getDefaultModelForProvider("webllm") };
  }
  if (settings.engine === "wasm") {
    return { ...settings, provider: "wllama", modelId: getDefaultModelForProvider("wllama") };
  }
  return { ...settings, provider: DEFAULT_ASK_PROVIDER, modelId: DEFAULT_ASK_MODEL };
}

function isAskProvider(value: unknown): value is AskProvider {
  return value === "ollama" || value === "webllm" || value === "wllama" || value === "openai";
}

function sanitizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "") || DEFAULT_ASK_SETTINGS.openaiBaseUrl;
}

function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
