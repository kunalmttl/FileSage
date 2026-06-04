"use client";

import { FileText, Loader2, Quote } from "lucide-react";
import type { ContextChunk } from "@/features/ask/context-builder";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

export function SourcePanel({
  chunks,
  loading,
}: {
  chunks: ContextChunk[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Retrieving local evidence
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!chunks.length) {
    return (
      <div className="flex gap-3 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
        <Quote className="mt-0.5 size-4 shrink-0" />
        No retrieved evidence yet.
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[620px]">
      <div className="space-y-3 pr-3">
        {chunks.map((chunk) => (
          <div key={chunk.index} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 shrink-0 text-teal-600" />
                  <p className="truncate text-sm font-semibold">{chunk.fileName}</p>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {chunk.relativePath}
                </p>
              </div>
              <Badge variant="outline" className="rounded-full">
                [{chunk.index}]
              </Badge>
            </div>
            <p className="mt-3 line-clamp-5 text-xs leading-5 text-muted-foreground">
              {chunk.text.replace(/\s+/g, " ")}
            </p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
