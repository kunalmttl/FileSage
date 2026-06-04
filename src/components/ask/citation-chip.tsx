"use client";

import type { ContextChunk } from "@/features/ask/context-builder";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CitationChip({
  index,
  contextChunks,
}: {
  index: number;
  contextChunks?: ContextChunk[];
}) {
  const chunk = contextChunks?.find((item) => item.index === index);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="mx-0.5 inline-flex cursor-help items-center rounded-full bg-teal-600 px-1.5 py-0.5 align-baseline text-[10px] font-semibold leading-none text-white">
          [{index}]
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm items-start bg-card p-3 text-left text-card-foreground shadow-lg">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold">{chunk?.fileName ?? "Unknown source"}</p>
          {chunk?.relativePath ? (
            <p className="text-[10px] text-muted-foreground">{chunk.relativePath}</p>
          ) : null}
          <p className="line-clamp-5 text-xs leading-5 text-muted-foreground">
            {chunk?.text.replace(/\s+/g, " ").slice(0, 300) ?? "Citation source was not found."}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
