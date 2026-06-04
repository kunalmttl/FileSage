"use client";

import { AlertCircle, CheckCircle2, Cpu, Loader2, Square } from "lucide-react";
import type { LLMStatus } from "@/features/ask/llm-service";
import { getProviderLabel } from "@/features/ask/ask-settings";
import type { WebGPUStatus } from "@/features/ask/webgpu-check";
import { Button } from "@/components/ui/button";

export function ModelStatusBar({
  status,
  webgpu,
  onLoad,
  onStop,
}: {
  status: LLMStatus;
  webgpu: WebGPUStatus | null;
  onLoad: () => void;
  onStop: () => void;
}) {
  const unsupported = webgpu?.supported === false;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        {status.state === "loading" || status.state === "checking-provider" ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : unsupported || status.state === "error" ? (
          <AlertCircle className="size-4 shrink-0 text-destructive" />
        ) : status.state === "ready" ? (
          <CheckCircle2 className="size-4 shrink-0 text-teal-600" />
        ) : (
          <Cpu className="size-4 shrink-0 text-muted-foreground" />
        )}

        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{statusLabel(status, webgpu)}</p>
          {status.state === "loading" ? (
            <div className="mt-1 h-1.5 w-52 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-teal-600"
                style={{ width: `${Math.round((status.progress ?? 0) * 100)}%` }}
              />
            </div>
          ) : null}
        </div>
      </div>

      {status.state === "generating" ? (
        <Button size="sm" variant="outline" className="rounded-full" onClick={onStop}>
          <Square className="size-3.5" />
          Stop
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={onLoad}
          disabled={status.state === "loading"}
        >
          Connect
        </Button>
      )}
    </div>
  );
}

function statusLabel(status: LLMStatus, webgpu: WebGPUStatus | null): string {
  if (status.state === "checking-provider") {
    return `Checking ${status.provider ? getProviderLabel(status.provider) : "answer provider"}...`;
  }
  if (status.state === "loading") return `${status.text} ${Math.round(status.progress * 100)}%`;
  if (status.state === "ready") {
    return `${getProviderLabel(status.provider)} ready - ${status.modelId}`;
  }
  if (status.state === "generating") return "Generating grounded answer...";
  if (webgpu?.supported === false) return "WebGPU is unavailable. Ollama, browser CPU, and API providers can still work.";
  if (status.state === "error") {
    return `${status.message} Retrieval-only answers are still enabled.`;
  }
  return "Retrieval-only Ask is ready. Connect an answer provider for generated answers.";
}
