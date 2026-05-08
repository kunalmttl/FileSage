/**
 * Search service — orchestrates hybrid search.
 *
 * Pipeline:
 *  1. Tokenize query
 *  2. Fetch postings + term stats + chunk stats from IndexedDB
 *  3. BM25 keyword scoring
 *  4. Embed query + dot-product vector scoring (flat scan)
 *  5. RRF fusion
 *  6. File-level metadata boost (filename match, recency)
 *  7. Collapse to file-grouped results with snippets
 */

import {
  getChunkStats,
  getPostingsForTerms,
  getTermStats,
  getVaultStat,
  listAllChunks,
  listAllFiles,
  listChunksForVault,
  listFilesForVault,
  listVaults,
} from "@/lib/db/filesage-db";
import type { ChunkRecord, FileEntryRecord } from "@/lib/db/types";
import { embedQuery } from "@/features/embeddings/embed-pipeline";
import { scoreBM25 } from "@/features/retrieval/bm25";
import { reciprocalRankFusion } from "@/features/retrieval/fusion";
import { extractSnippet } from "@/features/retrieval/snippets";
import { tokenize } from "@/features/retrieval/tokenizer";
import { loadVectorCache } from "@/features/retrieval/vector-cache";
import { scanVectors } from "@/features/retrieval/vector-scan";
import { recordPerformanceMetric } from "@/lib/performance/metrics";

export type SearchResult = {
  file: FileEntryRecord;
  snippets: Array<{ text: string; html: string; chunkId: string }>;
  score: number;
  matchedTerms: string[];
  reasons: string[];
};

export type SearchOptions = {
  vaultId?: string;
  topK?: number;
  mode?: "keyword" | "semantic" | "hybrid";
  /** Pre-loaded file records — pass to avoid redundant DB reads in the UI */
  files?: FileEntryRecord[];
  /** Pre-loaded chunks — pass to avoid redundant DB reads */
  chunks?: ChunkRecord[];
  /** Query vector — if provided, enables semantic re-ranking */
  queryVector?: number[];
};

const MAX_SNIPPETS_PER_FILE = 2;
const TOP_K = 20;
const CANDIDATE_LIMIT = 150;

export async function search(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const startedAt = nowMs();
  let stageStartedAt = startedAt;
  const timings: Record<string, number> = {};
  const counts: Record<string, number> = {};

  function mark(stage: string) {
    const next = nowMs();
    timings[stage] = roundMs(next - stageStartedAt);
    stageStartedAt = next;
  }

  function finish(resultCount: number) {
    counts.results = resultCount;
    recordPerformanceMetric({
      kind: "search",
      label: `${mode}:${query.trim().slice(0, 80)}`,
      totalMs: roundMs(nowMs() - startedAt),
      counts,
      timings,
    });
  }

  const {
    vaultId,
    topK = TOP_K,
    mode = "hybrid",
    files,
    chunks,
    queryVector,
  } = options;

  if (!query.trim()) return [];

  const queryTerms = tokenize(query);
  counts.queryTerms = queryTerms.length;
  mark("tokenize");

  if (!queryTerms.length) return [];

  // Resolve which vault IDs to search across
  const vaultIds = vaultId
    ? [vaultId]
    : (await listVaults()).map((v) => v.id);
  counts.vaults = vaultIds.length;
  mark("resolveVaults");

  if (!vaultIds.length) {
    finish(0);
    return [];
  }

  const resolvedFiles =
    files ??
    (vaultId ? await listFilesForVault(vaultId) : await listAllFiles());
  counts.files = resolvedFiles.length;
  mark("loadFiles");

  const fileMap = new Map<string, FileEntryRecord>(
    resolvedFiles.map((f) => [f.id, f])
  );
  const allowedFileIds = files ? new Set(resolvedFiles.map((f) => f.id)) : undefined;

  // --- 1. Keyword retrieval across all relevant vaults ---
  const allPostingsByTerm = new Map<string, import("@/lib/db/types").PostingRecord[]>();
  const allTermStats = new Map<string, import("@/lib/db/types").TermStatRecord>();
  let totalChunks = 0;
  let avgChunkLength = 100;
  let totalChunkLength = 0;

  if (mode !== "semantic") {
    for (const vid of vaultIds) {
      const [postings, termStats, vaultStat] = await Promise.all([
        getPostingsForTerms(vid, queryTerms),
        getTermStats(vid, queryTerms),
        getVaultStat(vid),
      ]);

      // Merge postings
      for (const [term, posts] of postings.entries()) {
        const existing = allPostingsByTerm.get(term) ?? [];
        allPostingsByTerm.set(term, [...existing, ...posts]);
      }

      // Merge term stats (accumulate df)
      for (const [term, stat] of termStats.entries()) {
        const existing = allTermStats.get(term);
        if (existing) {
          allTermStats.set(term, { ...existing, df: existing.df + stat.df });
        } else {
          allTermStats.set(term, stat);
        }
      }

      if (vaultStat) {
        totalChunks += vaultStat.chunkCount;
        totalChunkLength += vaultStat.avgChunkLength * vaultStat.chunkCount;
      }
    }

    avgChunkLength = totalChunks > 0 ? totalChunkLength / totalChunks : 100;
  }

  // Gather candidate chunk IDs for stat lookup
  const candidateChunkIds = new Set<string>();
  for (const posts of allPostingsByTerm.values()) {
    for (const p of posts) candidateChunkIds.add(p.chunkId);
  }

  const chunkStatsById = await getChunkStats(Array.from(candidateChunkIds));
  counts.keywordCandidateChunks = candidateChunkIds.size;
  mark("keywordDb");

  const keywordHits =
    mode === "semantic"
      ? []
      : scoreBM25(
          queryTerms,
          allPostingsByTerm,
          allTermStats,
          chunkStatsById,
          totalChunks || 1,
          avgChunkLength
        ).slice(0, CANDIDATE_LIMIT);
  counts.keywordHits = keywordHits.length;
  mark("bm25");

  // --- 2. Vector retrieval ---
  let vectorHits: Array<{ chunkId: string; fileId: string; score: number }> = [];

  if (mode !== "keyword") {
    const vector = queryVector?.length ? queryVector : await embedQuery(query);
    mark("embedQuery");
    const vectors = await loadVectorCache(vaultId);
    counts.cachedVectors = vectors.length;
    mark("loadVectors");
    vectorHits = scanVectors(vector, vectors, CANDIDATE_LIMIT, allowedFileIds);
    mark("vectorScan");
  }
  counts.vectorHits = vectorHits.length;

  // --- 3. RRF fusion ---
  const fused = reciprocalRankFusion(keywordHits, vectorHits, CANDIDATE_LIMIT);
  counts.fusedHits = fused.length;
  mark("fusion");

  if (!fused.length) {
    finish(0);
    return [];
  }

  // --- 4. Load chunk text for snippets ---
  const chunkTextMap = new Map<string, ChunkRecord>();
  if (chunks) {
    for (const c of chunks) chunkTextMap.set(c.id, c);
  } else {
    if (!vaultId) {
      const allChunks = await listAllChunks();
      for (const c of allChunks) chunkTextMap.set(c.id, c);
    } else {
      const vaultChunks = await listChunksForVault(vaultId);
      for (const c of vaultChunks) chunkTextMap.set(c.id, c);
    }
  }
  counts.loadedChunks = chunkTextMap.size;
  mark("loadChunks");

  // --- 5. Group by file ---
  const fileGroups = new Map<
    string,
    { score: number; matchedTerms: Set<string>; snippets: SearchResult["snippets"] }
  >();

  for (const hit of fused) {
    const chunk = chunkTextMap.get(hit.chunkId);
    if (!chunk) continue;

    const snippet = extractSnippet(chunk.text, hit.matchedTerms);
    const existing = fileGroups.get(hit.fileId);

    if (existing) {
      existing.score += hit.rrfScore;
      for (const t of hit.matchedTerms) existing.matchedTerms.add(t);
      if (existing.snippets.length < MAX_SNIPPETS_PER_FILE) {
        existing.snippets.push({ ...snippet, chunkId: hit.chunkId });
      }
    } else {
      fileGroups.set(hit.fileId, {
        score: hit.rrfScore,
        matchedTerms: new Set(hit.matchedTerms),
        snippets: [{ ...snippet, chunkId: hit.chunkId }],
      });
    }
  }
  counts.fileGroups = fileGroups.size;
  mark("groupFiles");

  // --- 6. Build final results ---
  const queryLower = query.toLowerCase();
  const extensionHints = extractExtensionHints(queryLower);
  const recentThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const results: SearchResult[] = [];

  for (const [fileId, group] of fileGroups.entries()) {
    const file = fileMap.get(fileId);
    if (!file) continue;

    const matchedTerms = Array.from(group.matchedTerms);
    const reasons: string[] = [];
    let score = group.score;

    if (file.name.toLowerCase().includes(queryLower)) {
      score += 0.3;
      reasons.push("Filename match");
    }
    if (matchedTerms.some((t) => file.relativePath.toLowerCase().includes(t))) {
      score += 0.1;
      reasons.push("Path match");
    }
    if (extensionHints.has(file.extension.toLowerCase())) {
      score += 0.1;
      reasons.push("File type hint");
    }
    if (file.lastModified >= recentThreshold) {
      score += 0.05;
      reasons.push("Recently modified");
    }
    const hasSemanticHit = group.snippets.some((s) =>
      vectorHits.some((v) => v.chunkId === s.chunkId)
    );
    if (hasSemanticHit) {
      reasons.push("Semantic match");
    }
    if (matchedTerms.length > 0) {
      reasons.push(`${matchedTerms.length} keyword${matchedTerms.length > 1 ? "s" : ""} matched`);
    }

    results.push({ file, snippets: group.snippets, score, matchedTerms, reasons });
  }

  const sortedResults = results.sort((a, b) => b.score - a.score).slice(0, topK);
  mark("buildResults");
  finish(sortedResults.length);
  return sortedResults;
}

function extractExtensionHints(queryLower: string): Set<string> {
  const hints = new Set<string>();
  for (const match of queryLower.matchAll(/(?:^|\s)\.([a-z0-9]{1,12})(?=\s|$)/g)) {
    if (match[1]) hints.add(match[1]);
  }
  return hints;
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function roundMs(value: number): number {
  return Math.round(value * 10) / 10;
}
