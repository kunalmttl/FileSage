"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  File,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { search } from "@/features/retrieval/search-service";
import type { SearchResult } from "@/features/retrieval/search-service";
import { listAllFiles, listFilesForVault, listVaults } from "@/lib/db/filesage-db";
import type { VaultRecord } from "@/lib/db/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CODE_EXTS = new Set(["js","ts","tsx","jsx","py","rs","go","java","c","cpp","cs","html","css","json","yaml","sh"]);
const IMAGE_EXTS = new Set(["png","jpg","jpeg","gif","webp","svg","ico"]);
const VIDEO_EXTS = new Set(["mp4","mov","avi","mkv","webm"]);

function FileIcon({ ext }: { ext: string }) {
  const e = ext.toLowerCase();
  if (IMAGE_EXTS.has(e)) return <FileImage className="size-4 shrink-0 text-blue-500" />;
  if (VIDEO_EXTS.has(e)) return <FileVideo className="size-4 shrink-0 text-purple-500" />;
  if (CODE_EXTS.has(e)) return <FileCode className="size-4 shrink-0 text-emerald-600" />;
  if (e === "pdf") return <FileText className="size-4 shrink-0 text-orange-500" />;
  if (["txt","md","mdx"].includes(e)) return <FileText className="size-4 shrink-0 text-muted-foreground" />;
  return <File className="size-4 shrink-0 text-muted-foreground" />;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const u = ["B","KB","MB","GB"];
  const e = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), u.length - 1);
  return `${(bytes / 1024 ** e).toFixed(e === 0 ? 0 : 1)} ${u[e]}`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

type SearchMode = "hybrid" | "keyword" | "semantic";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SearchWorkspaceShell() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("hybrid");
  const [vaults, setVaults] = useState<VaultRecord[]>([]);
  const [selectedVault, setSelectedVault] = useState<string>("all");
  const [extFilter, setExtFilter] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Searching...");
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchGenerationRef = useRef(0);

  useEffect(() => {
    void listVaults().then(setVaults);
  }, []);

  const runSearch = useCallback(async (q: string, vault: string, ext: string, m: SearchMode) => {
    const generation = ++searchGenerationRef.current;
    if (!q.trim()) { setResults([]); setHasSearched(false); return; }
    setLoading(true);
    setLoadingLabel(m === "keyword" ? "Searching..." : "Embedding query...");
    setHasSearched(true);
    try {
      const files = vault === "all" ? await listAllFiles() : await listFilesForVault(vault);
      const filteredFiles = ext ? files.filter(f => f.extension === ext.replace(/^\./, "")) : files;

      const hits = await search(q, {
        vaultId: vault === "all" ? undefined : vault,
        files: filteredFiles,
        topK: 20,
        mode: m,
      });

      if (generation !== searchGenerationRef.current) return;
      setResults(hits);
      setSelected(hits[0] ?? null);
    } finally {
      if (generation === searchGenerationRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Debounced search on query/filter change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(query, selectedVault, extFilter, mode);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selectedVault, extFilter, mode, runSearch]);

  function clearAll() {
    setQuery("");
    setExtFilter("");
    setSelectedVault("all");
    setResults([]);
    setHasSearched(false);
    setSelected(null);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      {/* Left — search + results */}
      <section className="space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          {loading
            ? <Loader2 className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            : query && <button onClick={clearAll} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
          }
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by meaning, filename, or file content…"
            className="h-12 rounded-2xl pl-11 pr-11 text-base shadow-none"
          />
        </div>

        {/* Mode + filters row */}
        <div className="flex flex-wrap items-center gap-2">
          {(["hybrid","keyword","semantic"] as SearchMode[]).map(m => {
            return (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors capitalize ${
                mode === m
                  ? "bg-foreground text-background border-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "semantic" && <Sparkles className="size-3" />}
              {m}
            </button>
            );
          })}

          <div className="ml-auto flex gap-2">
            <Input
              value={extFilter}
              onChange={e => setExtFilter(e.target.value)}
              placeholder=".ext"
              className="h-8 w-20 rounded-full text-xs"
            />
            {vaults.length > 1 && vaults.map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedVault(v.id === selectedVault ? "all" : v.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selectedVault === v.id
                    ? "bg-foreground text-background border-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {loading && !results.length ? (
          <SearchLoadingState label={loadingLabel} />
        ) : !hasSearched ? (
          <SearchEmptyState />
        ) : results.length === 0 ? (
          <NoResultsState query={query} onClear={clearAll} />
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground px-1">
              {results.length} result{results.length !== 1 ? "s" : ""} for <span className="font-medium text-foreground">&quot;{query}&quot;</span>
            </p>
            <SearchResultsList
              results={results}
              selected={selected}
              onSelect={setSelected}
            />
          </div>
        )}
      </section>

      {/* Right — detail panel */}
      <aside>
        {selected ? (
          <SearchDetailPanel result={selected} />
        ) : (
          <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Select a result to see details.
          </div>
        )}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results list
// ---------------------------------------------------------------------------

function SearchResultsList({
  results,
  selected,
  onSelect,
}: {
  results: SearchResult[];
  selected: SearchResult | null;
  onSelect: (r: SearchResult) => void;
}) {
  return (
    <div className="space-y-2">
      {results.map((result) => (
        <SearchResultCard
          key={result.file.id}
          result={result}
          isSelected={selected?.file.id === result.file.id}
          onSelect={() => onSelect(result)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result card
// ---------------------------------------------------------------------------

function SearchResultCard({
  result,
  isSelected,
  onSelect,
}: {
  result: SearchResult;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { file, snippets, reasons } = result;
  const dir = file.relativePath.includes("/")
    ? file.relativePath.substring(0, file.relativePath.lastIndexOf("/"))
    : "";

  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition-all hover:shadow-sm ${
        isSelected
          ? "border-foreground/20 bg-card shadow-sm ring-1 ring-foreground/10"
          : "bg-card hover:border-foreground/10"
      }`}
    >
      {/* File header */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <FileIcon ext={file.extension} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{file.name}</p>
            {file.extension && (
              <Badge variant="outline" className="shrink-0 rounded-full px-1.5 py-0 text-[10px]">
                .{file.extension}
              </Badge>
            )}
          </div>
          {dir && (
            <p className="truncate text-xs text-muted-foreground">{dir}</p>
          )}
        </div>
      </div>

      {/* Best snippet */}
      {snippets[0] && (
        <div
          className="mt-3 rounded-xl bg-secondary/50 px-3 py-2 text-xs leading-5 text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: snippets[0].html }}
        />
      )}

      {/* Reason badges */}
      {reasons.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {reasons.map(r => (
            <span key={r} className="rounded-full bg-accent/60 px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
              {r}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

function SearchDetailPanel({ result }: { result: SearchResult }) {
  const { file, snippets, matchedTerms, reasons, score } = result;

  return (
    <div className="rounded-3xl border bg-card shadow-none">
      <div className="border-b p-5">
        <div className="flex items-start gap-3">
          <FileIcon ext={file.extension} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-sm">{file.name}</p>
            <p className="truncate text-xs text-muted-foreground">{file.relativePath}</p>
          </div>
        </div>

        {/* Metadata grid */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <DetailMeta label="Size" value={formatBytes(file.size)} />
          <DetailMeta label="Modified" value={formatDate(file.lastModified)} />
          <DetailMeta label="Type" value={file.extension ? `.${file.extension}` : file.type || "—"} />
          <DetailMeta label="Score" value={score.toFixed(4)} />
        </div>
      </div>

      {/* Why this result */}
      <div className="border-b p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Why this result</p>
        <div className="flex flex-wrap gap-1.5">
          {reasons.map(r => (
            <span key={r} className="rounded-full border px-2.5 py-0.5 text-xs font-medium">
              {r}
            </span>
          ))}
        </div>
        {matchedTerms.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {matchedTerms.map(t => (
              <span key={t} className="rounded bg-accent/50 px-1.5 py-0.5 font-mono text-[10px] text-accent-foreground">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Snippets */}
      <div className="p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Matched snippets
        </p>
        <ScrollArea className="max-h-64">
          <div className="space-y-3">
            {snippets.map((s, i) => (
              <div
                key={i}
                className="rounded-xl border bg-secondary/30 px-3 py-2.5 text-xs leading-5 text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: s.html }}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function DetailMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-secondary/30 px-3 py-2">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-xs font-semibold">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// State placeholders
// ---------------------------------------------------------------------------

function SearchEmptyState() {
  return (
    <div className="rounded-3xl border border-dashed p-12 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border bg-card">
        <Search className="size-5 text-muted-foreground" />
      </div>
      <p className="font-medium text-sm">Search your vault</p>
      <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground leading-6">
        Type a query to search by meaning, keywords, or filename across all indexed files.
      </p>
    </div>
  );
}

function NoResultsState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed p-10 text-center">
      <p className="font-medium text-sm">No results for &quot;{query}&quot;</p>
      <p className="mt-1 text-sm text-muted-foreground">Try different keywords or connect more vaults.</p>
      <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={onClear}>
        Clear search
      </Button>
    </div>
  );
}

function SearchLoadingState({ label }: { label: string }) {
  return (
    <div className="space-y-2">
      <p className="px-1 text-xs text-muted-foreground">{label}</p>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-2xl" />
      ))}
    </div>
  );
}
