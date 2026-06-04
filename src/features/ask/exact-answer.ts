import type { ContextChunk } from "@/features/ask/context-builder";

const AADHAAR_QUERY_RE = /\b(?:aadhaar|aadhar|uidai)\b/i;
const AADHAAR_NUMBER_RE = /\b\d{4}\s+\d{4}\s+\d{4}\b/g;
const EXCLUDED_NUMBER_CONTEXT_RE = /\b(?:vid|enrolment|enrollment|mobile|pin code|dob)\b/i;

export function composeExactAnswer(question: string, contextChunks: ContextChunk[]): string | null {
  if (!AADHAAR_QUERY_RE.test(question)) return null;

  const queryTerms = extractPersonTerms(question);
  const candidates = contextChunks
    .flatMap((chunk) => extractAadhaarCandidates(chunk, queryTerms))
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best) return null;

  return `The Aadhaar number is **${best.number}** [${best.chunk.index}]`;
}

function extractPersonTerms(question: string): string[] {
  return Array.from(
    new Set(
      question
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length > 2)
        .filter(
          (term) =>
            ![
              "aadhaar",
              "aadhar",
              "card",
              "number",
              "what",
              "whose",
            ].includes(term)
        )
    )
  );
}

function extractAadhaarCandidates(
  chunk: ContextChunk,
  queryTerms: string[]
): Array<{ chunk: ContextChunk; number: string; score: number }> {
  const text = chunk.text.replace(/\s+/g, " ");
  const matches = Array.from(text.matchAll(AADHAAR_NUMBER_RE));
  const lower = text.toLowerCase();

  return matches
    .map((match) => {
      const number = match[0].replace(/\s+/g, " ");
      const index = match.index ?? 0;
      const nearby = text.slice(Math.max(0, index - 120), index + number.length + 80);
      const nearbyLower = nearby.toLowerCase();
      let score = 0;

      if (lower.includes("aadhaar")) score += 20;
      if (lower.includes("uidai")) score += 8;
      if (chunk.fileName.toLowerCase().includes("aadhar")) score += 8;
      if (chunk.fileName.toLowerCase().includes("aadhaar")) score += 8;
      if (queryTerms.some((term) => lower.includes(term))) score += 20;
      if (EXCLUDED_NUMBER_CONTEXT_RE.test(nearbyLower)) score -= 30;
      if (nearbyLower.includes("aadhaar")) score += 20;

      return { chunk, number, score };
    })
    .filter((candidate) => candidate.score > 0);
}
