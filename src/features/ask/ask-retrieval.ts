import { composeExactAnswer } from "@/features/ask/exact-answer";
import { planAskQuery, type AskQueryPlan } from "@/features/ask/query-planner";
import { search, type SearchResult } from "@/features/retrieval/search-service";
import { getChunksByIds } from "@/lib/db/filesage-db";
import type { FileEntryRecord } from "@/lib/db/types";
import type { ContextChunk } from "@/features/ask/context-builder";

type SearchMode = "keyword" | "hybrid" | "semantic";

export type AskSearchRun = {
  query: string;
  mode: SearchMode;
  resultCount: number;
  snippetCount: number;
  ms: number;
};

export type AskRetrievalDiagnostics = {
  totalMs: number;
  selectedChunks: number;
  selectedFiles: string[];
  promptChars: number;
  candidateChunks: number;
};

export type AskRetrievalResult = {
  contextChunks: ContextChunk[];
  queryPlan: AskQueryPlan;
  searchRuns: AskSearchRun[];
  diagnostics: AskRetrievalDiagnostics;
  exactAnswer: string | null;
};

type RetrieveOptions = {
  vaultId?: string;
  maxChunks: number;
};

type CandidateChunk = {
  chunkId: string;
  file: FileEntryRecord;
  score: number;
  bestRank: number;
  modes: Set<SearchMode>;
  queries: Set<string>;
  matchedTerms: Set<string>;
  reasons: Set<string>;
};

const SEARCH_MODES: SearchMode[] = ["keyword", "hybrid", "semantic"];
const MAX_CONTEXT_CHARS = 8_000;
const CANDIDATE_LOAD_MULTIPLIER = 4;

export async function retrieveAskContext(
  question: string,
  options: RetrieveOptions
): Promise<AskRetrievalResult> {
  const startedAt = performance.now();
  const queryPlan = planAskQuery(question);
  const searchRuns: AskSearchRun[] = [];
  const candidates = new Map<string, CandidateChunk>();
  const topK = Math.max(options.maxChunks * 2, 8);

  console.info("[ask:retrieval] query plan", queryPlan);

  for (const plannedQuery of queryPlan.searchQueries) {
    for (const mode of SEARCH_MODES) {
      const runStartedAt = performance.now();
      let results: SearchResult[] = [];
      try {
        results = await search(plannedQuery.query, {
          mode,
          topK,
          vaultId: options.vaultId,
        });
      } catch (error) {
        console.warn("[ask:retrieval] search run failed", {
          query: plannedQuery.query,
          mode,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      searchRuns.push({
        query: plannedQuery.query,
        mode,
        resultCount: results.length,
        snippetCount: results.reduce((count, result) => count + result.snippets.length, 0),
        ms: Math.round(performance.now() - runStartedAt),
      });
      mergeResults(candidates, results, {
        query: plannedQuery.query,
        queryPriority: plannedQuery.priority,
        mode,
        queryPlan,
      });
    }
  }

  const rankedCandidates = Array.from(candidates.values())
    .sort((a, b) => b.score - a.score || a.bestRank - b.bestRank)
    .slice(0, Math.max(options.maxChunks * CANDIDATE_LOAD_MULTIPLIER, options.maxChunks));
  const chunksById = new Map(
    (await getChunksByIds(rankedCandidates.map((candidate) => candidate.chunkId))).map((chunk) => [
      chunk.id,
      chunk,
    ])
  );

  const contextChunks: ContextChunk[] = [];
  let promptChars = 0;

  for (const candidate of rescoreWithFullText(rankedCandidates, chunksById, queryPlan)) {
    if (contextChunks.length >= options.maxChunks) break;
    const chunk = chunksById.get(candidate.chunkId);
    if (!chunk) continue;
    if (promptChars + chunk.text.length > MAX_CONTEXT_CHARS) continue;

    contextChunks.push({
      index: contextChunks.length + 1,
      chunkId: chunk.id,
      fileId: candidate.file.id,
      fileName: candidate.file.name,
      relativePath: candidate.file.relativePath,
      text: chunk.text,
      score: candidate.score,
      matchedTerms: Array.from(candidate.matchedTerms),
      retrievalModes: Array.from(candidate.modes),
      searchQueries: Array.from(candidate.queries),
      reasons: Array.from(candidate.reasons),
    });
    promptChars += chunk.text.length;
  }

  const exactAnswer = composeExactAnswer(question, contextChunks);
  const diagnostics: AskRetrievalDiagnostics = {
    totalMs: Math.round(performance.now() - startedAt),
    selectedChunks: contextChunks.length,
    selectedFiles: Array.from(new Set(contextChunks.map((chunk) => chunk.relativePath))),
    promptChars,
    candidateChunks: candidates.size,
  };

  console.info("[ask:retrieval] complete", {
    queryPlan,
    searchRuns,
    diagnostics,
    exactAnswer,
  });

  return {
    contextChunks,
    queryPlan,
    searchRuns,
    diagnostics,
    exactAnswer,
  };
}

function mergeResults(
  candidates: Map<string, CandidateChunk>,
  results: SearchResult[],
  {
    query,
    queryPriority,
    mode,
    queryPlan,
  }: {
    query: string;
    queryPriority: number;
    mode: SearchMode;
    queryPlan: AskQueryPlan;
  }
): void {
  results.forEach((result, resultIndex) => {
    result.snippets.forEach((snippet, snippetIndex) => {
      const rank = resultIndex * 2 + snippetIndex + 1;
      const existing = candidates.get(snippet.chunkId);
      const candidate =
        existing ??
        {
          chunkId: snippet.chunkId,
          file: result.file,
          score: 0,
          bestRank: rank,
          modes: new Set<SearchMode>(),
          queries: new Set<string>(),
          matchedTerms: new Set<string>(),
          reasons: new Set<string>(),
        };

      candidate.score += scoreResult(result, snippet.text, rank, mode, queryPriority, queryPlan);
      candidate.bestRank = Math.min(candidate.bestRank, rank);
      candidate.modes.add(mode);
      candidate.queries.add(query);
      for (const term of result.matchedTerms) candidate.matchedTerms.add(term);
      for (const reason of result.reasons) candidate.reasons.add(reason);
      candidates.set(snippet.chunkId, candidate);
    });
  });
}

function scoreResult(
  result: SearchResult,
  snippetText: string,
  rank: number,
  mode: SearchMode,
  queryPriority: number,
  queryPlan: AskQueryPlan
): number {
  const modeWeight = mode === "keyword" ? 10 : mode === "hybrid" ? 8 : 5;
  const rankScore = modeWeight / Math.max(rank, 1);
  const text = `${result.file.name} ${result.file.relativePath} ${snippetText}`.toLowerCase();
  const keywordMatches = queryPlan.keywords.filter((term) => text.includes(term)).length;
  const exactMatches = queryPlan.exactTerms.filter((term) =>
    normalizeText(text).includes(normalizeText(term))
  ).length;
  const pathMatches = queryPlan.keywords.filter((term) =>
    result.file.relativePath.toLowerCase().includes(term)
  ).length;

  return (
    rankScore +
    queryPriority / 100 +
    keywordMatches * 1.5 +
    exactMatches * 25 +
    pathMatches * 2 +
    result.score
  );
}

function rescoreWithFullText(
  candidates: CandidateChunk[],
  chunksById: Map<string, { text: string }>,
  queryPlan: AskQueryPlan
): CandidateChunk[] {
  return candidates
    .map((candidate) => {
      const chunk = chunksById.get(candidate.chunkId);
      if (!chunk) return candidate;
      const fullText = `${candidate.file.name} ${candidate.file.relativePath} ${chunk.text}`;
      const normalized = normalizeText(fullText);

      for (const term of queryPlan.keywords) {
        if (normalized.includes(normalizeText(term))) {
          candidate.score += 2;
          candidate.matchedTerms.add(term);
        }
      }
      for (const exact of queryPlan.exactTerms) {
        if (normalized.includes(normalizeText(exact))) {
          candidate.score += 30;
          candidate.matchedTerms.add(exact);
          candidate.reasons.add("Exact identifier match");
        }
      }
      if (candidate.modes.size > 1) candidate.score += candidate.modes.size * 3;
      if (candidate.queries.size > 1) candidate.score += candidate.queries.size;
      return candidate;
    })
    .sort((a, b) => b.score - a.score || a.bestRank - b.bestRank);
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
