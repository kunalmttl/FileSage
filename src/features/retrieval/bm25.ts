/**
 * BM25 scorer.
 * Scores chunk candidates given query terms, posting lists, term stats, and chunk stats.
 *
 * BM25 formula:
 *   score(q, d) = Σ IDF(t) * (tf(t,d) * (k1+1)) / (tf(t,d) + k1 * (1 - b + b * |d|/avgdl))
 *
 * Standard parameters: k1=1.5, b=0.75
 */

import type {
  ChunkStatRecord,
  PostingRecord,
  TermStatRecord,
} from "@/lib/db/types";

const K1 = 1.5;
const B = 0.75;

export type BM25Hit = {
  chunkId: string;
  fileId: string;
  score: number;
  matchedTerms: string[];
};

export function scoreBM25(
  queryTerms: string[],
  postingsByTerm: Map<string, PostingRecord[]>,
  termStatsByTerm: Map<string, TermStatRecord>,
  chunkStatsById: Map<string, ChunkStatRecord>,
  totalChunks: number,
  avgChunkLength: number
): BM25Hit[] {
  // Accumulate scores per chunkId
  const scores = new Map<string, { score: number; fileId: string; terms: Set<string> }>();

  for (const term of queryTerms) {
    const postings = postingsByTerm.get(term);
    if (!postings?.length) continue;

    const termStat = termStatsByTerm.get(term);
    const df = termStat?.df ?? postings.length;

    // IDF with smoothing to avoid negative values
    const idf = Math.log((totalChunks - df + 0.5) / (df + 0.5) + 1);

    for (const posting of postings) {
      const chunkStat = chunkStatsById.get(posting.chunkId);
      const docLen = chunkStat?.tokenCount ?? avgChunkLength;

      const tfNorm =
        (posting.tf * (K1 + 1)) /
        (posting.tf + K1 * (1 - B + B * (docLen / (avgChunkLength || 1))));

      const termScore = idf * tfNorm;

      const existing = scores.get(posting.chunkId);
      if (existing) {
        existing.score += termScore;
        existing.terms.add(term);
      } else {
        scores.set(posting.chunkId, {
          score: termScore,
          fileId: posting.fileId,
          terms: new Set([term]),
        });
      }
    }
  }

  return Array.from(scores.entries())
    .map(([chunkId, { score, fileId, terms }]) => ({
      chunkId,
      fileId,
      score,
      matchedTerms: Array.from(terms),
    }))
    .sort((a, b) => b.score - a.score);
}
