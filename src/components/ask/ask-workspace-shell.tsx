"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, SlidersHorizontal } from "lucide-react";
import { buildAskMessages, buildContextChunks } from "@/features/ask/context-builder";
import type { ContextChunk } from "@/features/ask/context-builder";
import { resolveCitations } from "@/features/ask/citation-resolver";
import { composeExactAnswer } from "@/features/ask/exact-answer";
import { composeFallbackAnswer } from "@/features/ask/fallback-answer";
import { createMessage, lastConversationMessages } from "@/features/ask/conversation-store";
import type { AskMessage } from "@/features/ask/conversation-store";
import {
  ASK_CONTEXT_MAX,
  ASK_CONTEXT_MIN,
  ASK_RESPONSE_MAX,
  ASK_RESPONSE_MIN,
  ASK_MODEL_OPTIONS,
  clampAskSettings,
  DEFAULT_ASK_SETTINGS,
  getDefaultModelForProvider,
  getProviderLabel,
  type AskProvider,
  loadAskSettings,
  saveAskSettings,
  type AskSettings,
} from "@/features/ask/ask-settings";
import { llmService, type LLMStatus } from "@/features/ask/llm-service";
import { checkWebGPUSupport, type WebGPUStatus } from "@/features/ask/webgpu-check";
import { search } from "@/features/retrieval/search-service";
import { listVaults } from "@/lib/db/filesage-db";
import type { VaultRecord } from "@/lib/db/types";
import { ChatThread } from "@/components/ask/chat-thread";
import { InputBar } from "@/components/ask/input-bar";
import { ModelStatusBar } from "@/components/ask/model-status-bar";
import { SourcePanel } from "@/components/ask/source-panel";
import { SuggestedQueries } from "@/components/ask/suggested-queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const NO_CONTEXT_MESSAGE =
  "I couldn't find any relevant content in your indexed files for that question. Try rephrasing, or check that the relevant files have been indexed.";

export function AskWorkspaceShell() {
  const [settings, setSettings] = useState<AskSettings>(DEFAULT_ASK_SETTINGS);
  const [status, setStatus] = useState<LLMStatus>({ state: "checking-provider" });
  const [webgpu, setWebgpu] = useState<WebGPUStatus | null>(null);
  const [vaults, setVaults] = useState<VaultRecord[]>([]);
  const [selectedVault, setSelectedVault] = useState("all");
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [input, setInput] = useState("");
  const [sourceChunks, setSourceChunks] = useState<ContextChunk[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setSettings(loadAskSettings()));
    void listVaults().then(setVaults);

    let cancelled = false;
    llmService.init((nextStatus) => {
      if (!cancelled) setStatus(nextStatus);
    });

    void checkWebGPUSupport().then((result) => {
      if (cancelled) return;
      setWebgpu(result);
      const loadedSettings = loadAskSettings();
      setSettings(loadedSettings);
      if (loadedSettings.provider !== "webllm" || result.supported) {
        llmService.loadModel({
          provider: loadedSettings.provider,
          modelId: loadedSettings.modelId,
          openaiBaseUrl: loadedSettings.openaiBaseUrl,
          openaiApiKey: loadedSettings.openaiApiKey,
        });
      } else {
        setStatus({ state: "error", message: result.reason });
      }
    });

    const refreshSettings = () => setSettings(loadAskSettings());
    window.addEventListener("filesage:ask-settings", refreshSettings);
    return () => {
      cancelled = true;
      window.removeEventListener("filesage:ask-settings", refreshSettings);
    };
  }, []);

  const busy =
    status.state === "checking-provider" ||
    status.state === "loading" ||
    status.state === "generating" ||
    sourcesLoading;
  const canAsk = !busy;

  const selectedVaultLabel = useMemo(() => {
    if (selectedVault === "all") return "All vaults";
    return vaults.find((vault) => vault.id === selectedVault)?.name ?? "Selected vault";
  }, [selectedVault, vaults]);

  const updateAssistantMessage = useCallback((id: string, patch: Partial<AskMessage>) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, ...patch } : message))
    );
  }, []);

  const loadModel = useCallback(() => {
    const requestedProvider =
      status.state === "error" && status.suggestedProvider
        ? status.suggestedProvider
        : settings.provider;
    if (requestedProvider === "webllm" && webgpu?.supported === false) return;

    const requestedModelId = status.state === "error" && status.suggestedModelId
      ? status.suggestedModelId
      : settings.modelId;
    const next = clampAskSettings({
      ...settings,
      provider: requestedProvider,
      modelId: requestedModelId,
    });
    console.info("[ask:ui] connect provider", {
      requestedProvider,
      requestedModelId,
      provider: next.provider,
      modelId: next.modelId,
    });
    if (next.provider !== settings.provider || next.modelId !== settings.modelId) {
      setSettings(next);
      saveAskSettings(next);
    }
    llmService.loadModel({
      provider: next.provider,
      modelId: next.modelId,
      openaiBaseUrl: next.openaiBaseUrl,
      openaiApiKey: next.openaiApiKey,
    });
  }, [settings, status, webgpu]);

  const stopGeneration = useCallback(() => {
    llmService.abort();
    setMessages((current) =>
      current.map((message) =>
        message.isStreaming
          ? { ...message, isStreaming: false, interrupted: true }
          : message
      )
    );
  }, []);

  const submitQuestion = useCallback(async () => {
    const question = input.trim();
    if (!question || busy || !canAsk) return;

    const userMessage = createMessage("user", question);
    const assistantMessage = createMessage("assistant", "", { isStreaming: true });
    const history = lastConversationMessages(messages);

    setInput("");
    setSourcesLoading(true);
    setSourceChunks([]);
    setMessages((current) => [...current, userMessage, assistantMessage]);

    try {
      const results = await search(question, {
        mode: "hybrid",
        topK: settings.contextChunks,
        vaultId: selectedVault === "all" ? undefined : selectedVault,
      });
      const contextChunks = await buildContextChunks(results, {
        maxChunks: settings.contextChunks,
      });
      console.info("[ask:ui] retrieval complete", {
        query: question,
        vaultId: selectedVault === "all" ? "all" : selectedVault,
        results: results.length,
        snippets: results.reduce((count, result) => count + result.snippets.length, 0),
        contextChunks: contextChunks.length,
        files: contextChunks.map((chunk) => chunk.relativePath),
      });
      setSourceChunks(contextChunks);
      setSourcesLoading(false);

      if (!contextChunks.length) {
        updateAssistantMessage(assistantMessage.id, {
          content: NO_CONTEXT_MESSAGE,
          isStreaming: false,
          contextChunks,
          citations: [],
        });
        return;
      }

      const exactAnswer = composeExactAnswer(question, contextChunks);
      if (exactAnswer) {
        console.info("[ask:ui] exact answer", {
          query: question,
          answer: exactAnswer,
        });
        updateAssistantMessage(assistantMessage.id, {
          content: exactAnswer,
          isStreaming: false,
          contextChunks,
          citations: resolveCitations(exactAnswer, contextChunks),
        });
        return;
      }

      if (status.state !== "ready") {
        const fallbackContent = composeFallbackAnswer(question, contextChunks);
        updateAssistantMessage(assistantMessage.id, {
          content: fallbackContent,
          isStreaming: false,
          contextChunks,
          citations: resolveCitations(fallbackContent, contextChunks),
        });
        return;
      }

      try {
        const llmMessages = buildAskMessages({
          question,
          contextChunks,
          history,
        }).map((message, index, messages) =>
          index === messages.length - 1 && shouldUseNoThink(settings.modelId)
            ? { ...message, content: `/no_think\n\n${message.content}` }
            : message
        );

        let finalContent = "";
        await llmService.generate(llmMessages, {
          provider: settings.provider,
          modelId: settings.modelId,
          openaiBaseUrl: settings.openaiBaseUrl,
          openaiApiKey: settings.openaiApiKey,
          temperature: settings.temperature,
          maxTokens: settings.maxResponseTokens,
          onToken: (delta) => {
            finalContent += delta;
            updateAssistantMessage(assistantMessage.id, {
              content: finalContent,
              contextChunks,
            });
          },
        });

        if (isUngroundedModelRefusal(finalContent)) {
          finalContent = composeFallbackAnswer(
            question,
            contextChunks,
            "The local model ignored the retrieved excerpts, so I answered from them directly."
          );
        }

        updateAssistantMessage(assistantMessage.id, {
          content: finalContent,
          isStreaming: false,
          contextChunks,
          citations: resolveCitations(finalContent, contextChunks),
        });
      } catch {
        const fallbackContent = composeFallbackAnswer(
          question,
          contextChunks,
          "The local model crashed, so I answered from the retrieved excerpts directly."
        );
        updateAssistantMessage(assistantMessage.id, {
          content: fallbackContent,
          isStreaming: false,
          contextChunks,
          citations: resolveCitations(fallbackContent, contextChunks),
        });
      }
    } catch (error) {
      setSourcesLoading(false);
      updateAssistantMessage(assistantMessage.id, {
        isStreaming: false,
        error: error instanceof Error ? error.message : "Ask mode failed.",
      });
    }
  }, [
    busy,
    canAsk,
    input,
    messages,
    selectedVault,
    settings.contextChunks,
    settings.maxResponseTokens,
    settings.modelId,
    settings.openaiApiKey,
    settings.openaiBaseUrl,
    settings.provider,
    settings.temperature,
    status.state,
    updateAssistantMessage,
  ]);

  function selectSuggestion(query: string) {
    setInput(query);
  }

  function updateSettings(patch: Partial<AskSettings>) {
    const next = clampAskSettings({ ...settings, ...patch });
    setSettings(next);
    saveAskSettings(next);
  }

  function updateProvider(provider: AskProvider) {
    updateSettings({ provider, modelId: getDefaultModelForProvider(provider) });
  }

  const modelOptions = ASK_MODEL_OPTIONS.filter((model) => model.provider === settings.provider);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="space-y-5">
        <ModelStatusBar
          status={status}
          webgpu={webgpu}
          onLoad={loadModel}
          onStop={stopGeneration}
        />

        <ChatThread messages={messages} />

        {!messages.length ? <SuggestedQueries onSelect={selectSuggestion} /> : null}

        <InputBar
          value={input}
          disabled={!canAsk || busy}
          onChange={setInput}
          onSubmit={submitQuestion}
          placeholder={
            canAsk
              ? `Ask ${selectedVaultLabel.toLowerCase()}...`
              : "Preparing local retrieval..."
          }
        />
      </section>

      <aside className="space-y-5">
        <Card className="rounded-3xl shadow-none">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <Database className="size-5" />
            </div>
            <CardTitle>Vault scope</CardTitle>
            <CardDescription>Choose which indexed files retrieval should use.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              value={selectedVault}
              onChange={(event) => setSelectedVault(event.target.value)}
              className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none"
            >
              <option value="all">All connected vaults</option>
              {vaults.map((vault) => (
                <option key={vault.id} value={vault.id}>
                  {vault.name}
                </option>
              ))}
            </select>
            <Badge variant="outline" className="rounded-full">
              {selectedVaultLabel}
            </Badge>
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-none">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <SlidersHorizontal className="size-5" />
            </div>
            <CardTitle>Ask controls</CardTitle>
            <CardDescription>Local generation settings for this browser.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Engine</span>
              <select
                value={settings.provider}
                onChange={(event) => updateProvider(event.target.value as AskProvider)}
                className="h-9 w-full rounded-xl border bg-background px-3"
              >
                <option value="ollama">Ollama local</option>
                <option value="webllm">Browser WebGPU</option>
                <option value="wllama">Browser CPU</option>
                <option value="openai">OpenAI-compatible API</option>
              </select>
              <span className="text-xs text-muted-foreground">
                {getProviderLabel(settings.provider)}
              </span>
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Model</span>
              <select
                value={settings.modelId}
                onChange={(event) => updateSettings({ modelId: event.target.value })}
                className="h-9 w-full rounded-xl border bg-background px-3"
              >
                {modelOptions.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>
            {settings.provider === "openai" ? (
              <>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">API base URL</span>
                  <input
                    value={settings.openaiBaseUrl}
                    onChange={(event) => updateSettings({ openaiBaseUrl: event.target.value })}
                    className="h-9 w-full rounded-xl border bg-background px-3"
                    placeholder="https://openrouter.ai/api/v1"
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">API key</span>
                  <input
                    type="password"
                    value={settings.openaiApiKey}
                    onChange={(event) => updateSettings({ openaiApiKey: event.target.value })}
                    className="h-9 w-full rounded-xl border bg-background px-3"
                    placeholder="Stored only in this browser"
                  />
                  <span className="text-xs text-muted-foreground">
                    Retrieved chunks are sent to this provider when selected.
                  </span>
                </label>
              </>
            ) : null}
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Context chunks</span>
              <input
                type="range"
                min={ASK_CONTEXT_MIN}
                max={ASK_CONTEXT_MAX}
                value={settings.contextChunks}
                onChange={(event) => updateSettings({ contextChunks: Number(event.target.value) })}
                className="w-full"
              />
              <span className="text-xs text-muted-foreground">{settings.contextChunks} chunks</span>
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Max response</span>
              <input
                type="number"
                min={ASK_RESPONSE_MIN}
                max={ASK_RESPONSE_MAX}
                step={128}
                value={settings.maxResponseTokens}
                onChange={(event) =>
                  updateSettings({ maxResponseTokens: Number(event.target.value) })
                }
                className="h-9 w-full rounded-xl border bg-background px-3"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Temperature</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={settings.temperature}
                onChange={(event) => updateSettings({ temperature: Number(event.target.value) })}
                className="h-9 w-full rounded-xl border bg-background px-3"
              />
            </label>
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-none">
          <CardHeader>
            <CardTitle>Sources</CardTitle>
            <CardDescription>Retrieved chunks used for the current answer.</CardDescription>
          </CardHeader>
          <CardContent>
            <SourcePanel chunks={sourceChunks} loading={sourcesLoading} />
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function shouldUseNoThink(modelId: string): boolean {
  return modelId.toLowerCase().includes("qwen3");
}

function isUngroundedModelRefusal(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    lower.includes("i don't have access to your local files") ||
    lower.includes("i don’t have access to your local files") ||
    lower.includes("i don't have enough information in your indexed files") ||
    lower.includes("i don’t have enough information in your indexed files")
  );
}
