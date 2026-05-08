/**
 * Keyword index builder.
 * Builds postings, term stats, and chunk stats from a batch of ChunkRecords.
 * Called after extraction so the lexical index stays in sync with the chunk store.
 */

import { savePostingBatch } from "@/lib/db/filesage-db";
import type {
  ChunkRecord,
  ChunkStatRecord,
  PostingRecord,
  TermStatRecord,
  VaultStatRecord,
} from "@/lib/db/types";
import { termFrequencies, tokenize } from "@/features/retrieval/tokenizer";

export async function buildKeywordIndex(
  chunks: ChunkRecord[],
  vaultId: string
): Promise<void> {
  if (!chunks.length) return;

  const postings: PostingRecord[] = [];
  const chunkStats: ChunkStatRecord[] = [];
  // term -> set of chunkIds (for df calculation)
  const termChunkSets = new Map<string, Set<string>>();

  for (const chunk of chunks) {
    const tokens = tokenize(chunk.text);
    const tf = termFrequencies(tokens);

    chunkStats.push({
      id: chunk.id,
      vaultId,
      fileId: chunk.fileId,
      tokenCount: tokens.length,
    });

    for (const [term, freq] of tf.entries()) {
      postings.push({
        id: `${vaultId}:${term}:${chunk.id}`,
        vaultId,
        term,
        chunkId: chunk.id,
        fileId: chunk.fileId,
        tf: freq,
      });

      if (!termChunkSets.has(term)) termChunkSets.set(term, new Set());
      termChunkSets.get(term)!.add(chunk.id);
    }
  }

  const termStats: TermStatRecord[] = Array.from(termChunkSets.entries()).map(
    ([term, chunkSet]) => ({
      id: `${vaultId}:${term}`,
      vaultId,
      term,
      df: chunkSet.size,
    })
  );

  const totalTokens = chunkStats.reduce((s, c) => s + c.tokenCount, 0);
  const vaultStat: VaultStatRecord = {
    id: vaultId,
    avgChunkLength: chunks.length > 0 ? totalTokens / chunks.length : 0,
    chunkCount: chunks.length,
  };

  await savePostingBatch(postings, termStats, chunkStats, vaultStat);
}
