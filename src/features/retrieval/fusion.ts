/**
 * Reciprocal Rank Fusion (RRF).
 * Combines keyword and vector ranked lists without score normalization.
 * RRF score = Σ 1 / (k + rank_i)  where k=60 (standard constant).
 */

const RRF_K = 60;

export type RankedChunk = {
  chunkId: string;
  fileId: string;
  rrfScore: number;
  keywordScore?: number;
  vectorScore?: number;
  matchedTerms: string[];
};

export function reciprocalRankFusion(
  keywordHits: Array<{ chunkId: string; fileId: string; score: number; matchedTerms: string[] }>,
  vectorHits: Array<{ chunkId: string; fileId: string; score: number }>,
  topK = 20
): RankedChunk[] {
  const scores = new Map<string, RankedChunk>();

  // Add keyword ranks
  keywordHits.forEach(({ chunkId, fileId, score, matchedTerms }, rank) => {
    scores.set(chunkId, {
      chunkId,
      fileId,
      rrfScore: 1 / (RRF_K + rank + 1),
      keywordScore: score,
      matchedTerms,
    });
  });

  // Add vector ranks (merge with existing)
  vectorHits.forEach(({ chunkId, fileId, score }, rank) => {
    const rrfContrib = 1 / (RRF_K + rank + 1);
    const existing = scores.get(chunkId);
    if (existing) {
      existing.rrfScore += rrfContrib;
      existing.vectorScore = score;
    } else {
      scores.set(chunkId, {
        chunkId,
        fileId,
        rrfScore: rrfContrib,
        vectorScore: score,
        matchedTerms: [],
      });
    }
  });

  return Array.from(scores.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, topK);
}
