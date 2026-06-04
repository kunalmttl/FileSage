"use client";

import { AlertCircle, CheckCircle2, Square } from "lucide-react";
import type { AskMessage } from "@/features/ask/conversation-store";
import { segmentText } from "@/features/ask/citation-resolver";
import { CitationChip } from "@/components/ask/citation-chip";
import { Badge } from "@/components/ui/badge";

export function MessageBubble({ message }: { message: AskMessage }) {
  const isUser = message.role === "user";

  return (
    <article className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] rounded-2xl border px-4 py-3 text-sm leading-6 ${
          isUser
            ? "bg-foreground text-background"
            : message.error
              ? "border-destructive/30 bg-destructive/5"
              : "bg-card"
        }`}
      >
        {message.error ? (
          <div className="flex gap-2 text-destructive">
            <AlertCircle className="mt-1 size-4 shrink-0" />
            <p>{message.error}</p>
          </div>
        ) : message.isStreaming ? (
          <p className="whitespace-pre-wrap">
            {message.content}
            <span className="ml-0.5 animate-pulse">▋</span>
          </p>
        ) : (
          <SegmentedContent message={message} />
        )}

        {!isUser && !message.isStreaming && message.citations?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
            {message.citations.map((citation) => (
              <Badge key={citation.index} variant="outline" className="rounded-full">
                [{citation.index}] {citation.fileName}
              </Badge>
            ))}
          </div>
        ) : null}

        {!isUser && message.interrupted ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Square className="size-3" />
            Stopped
          </div>
        ) : null}

        {!isUser && !message.isStreaming && !message.error && !message.interrupted ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3" />
            Grounded answer
          </div>
        ) : null}
      </div>
    </article>
  );
}

function SegmentedContent({ message }: { message: AskMessage }) {
  const segments = segmentText(message.content);

  return (
    <p className="whitespace-pre-wrap">
      {segments.map((segment, index) =>
        segment.type === "citation" ? (
          <CitationChip
            key={`${segment.index}-${index}`}
            index={segment.index}
            contextChunks={message.contextChunks}
          />
        ) : (
          <span key={index}>{segment.content}</span>
        )
      )}
    </p>
  );
}
