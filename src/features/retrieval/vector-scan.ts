import type { CachedVector } from "@/features/retrieval/vector-cache";

export type VectorHit = {
  chunkId: string;
  fileId: string;
  score: number;
};

export function scanVectors(
  queryVector: number[] | Float32Array,
  vectors: CachedVector[],
  topK = 150,
  allowedFileIds?: Set<string>
): VectorHit[] {
  if (!queryVector.length || !vectors.length || topK <= 0) return [];

  const query =
    queryVector instanceof Float32Array
      ? queryVector
      : Float32Array.from(queryVector);

  const hits: VectorHit[] = [];

  for (const candidate of vectors) {
    if (allowedFileIds && !allowedFileIds.has(candidate.fileId)) continue;

    hits.push({
      chunkId: candidate.chunkId,
      fileId: candidate.fileId,
      score: dotProduct(query, candidate.vector),
    });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, topK);
}

function dotProduct(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) sum += a[i]! * b[i]!;
  return sum;
}
