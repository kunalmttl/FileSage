import type { ContextChunk } from "@/features/ask/context-builder";

export type ResolvedCitation = {
  index: number;
  fileName: string;
  relativePath: string;
  fileId: string;
  snippet: string;
};

export type TextSegment =
  | { type: "text"; content: string }
  | { type: "citation"; index: number };

export function parseCitations(text: string): number[] {
  const matches = Array.from(text.matchAll(/\[(\d+)\]/g));
  return Array.from(new Set(matches.map((match) => Number(match[1]))))
    .filter((index) => Number.isFinite(index))
    .sort((a, b) => a - b);
}

export function resolveCitations(
  text: string,
  contextChunks: ContextChunk[] = []
): ResolvedCitation[] {
  return parseCitations(text)
    .map((index) => contextChunks.find((chunk) => chunk.index === index))
    .filter((chunk): chunk is ContextChunk => Boolean(chunk))
    .map((chunk) => ({
      index: chunk.index,
      fileName: chunk.fileName,
      relativePath: chunk.relativePath,
      fileId: chunk.fileId,
      snippet: summarizeSnippet(chunk.text),
    }));
}

export function segmentText(text: string): TextSegment[] {
  return text
    .split(/(\[\d+\])/g)
    .filter((part) => part.length > 0)
    .map((part) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) return { type: "citation", index: Number(match[1]) };
      return { type: "text", content: part };
    });
}

function summarizeSnippet(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 300 ? `${normalized.slice(0, 300)}...` : normalized;
}
