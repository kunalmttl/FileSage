import type { ContextChunk } from "@/features/ask/context-builder";

const STOPWORDS = new Set([
  "about",
  "card",
  "does",
  "find",
  "from",
  "have",
  "into",
  "tell",
  "that",
  "the",
  "this",
  "what",
  "when",
  "where",
  "which",
  "with",
  "your",
]);

type Candidate = {
  chunk: ContextChunk;
  text: string;
  score: number;
};

export function composeFallbackAnswer(
  question: string,
  contextChunks: ContextChunk[],
  reason = "The local model is unavailable, so I answered from the retrieved excerpts directly."
): string {
  const terms = queryTerms(question);
  const candidates = contextChunks
    .flatMap((chunk) => candidateSentences(chunk, terms))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const lines = candidates.length
    ? candidates.map((candidate) => `- ${candidate.text} [${candidate.chunk.index}]`)
    : contextChunks
        .slice(0, 3)
        .map((chunk) => `- ${trimSnippet(chunk.text)} [${chunk.index}]`);

  return `${reason}\n\n${lines.join("\n")}`;
}

function queryTerms(question: string): string[] {
  return Array.from(
    new Set(
      question
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((term) => term.trim())
        .filter((term) => term.length > 2 && !STOPWORDS.has(term))
    )
  );
}

function candidateSentences(chunk: ContextChunk, terms: string[]): Candidate[] {
  const parts = chunk.text
    .replace(/([.!?])\s+/g, "$1\n")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return parts
    .map((text) => ({
      chunk,
      text: trimSnippet(text),
      score: scoreText(text, terms),
    }))
    .filter((candidate) => candidate.score > 0);
}

function scoreText(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (lower.includes(term)) score += term.length;
  }

  if (terms.some((term) => term.includes("aadhaar") || term.includes("aadhar"))) {
    if (/\b\d{4}\s?\d{4}\s?\d{4}\b/.test(text)) score += 20;
  }

  return score;
}

function trimSnippet(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 360 ? `${compact.slice(0, 357)}...` : compact;
}
