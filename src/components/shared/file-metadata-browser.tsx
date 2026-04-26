"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  File,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  Filter,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { listVaults, queryFiles } from "@/lib/db/filesage-db";
import type { FileEntryRecord, VaultRecord } from "@/lib/db/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 50;

const CODE_EXTENSIONS = new Set([
  "js", "ts", "tsx", "jsx", "py", "rs", "go", "java", "c", "cpp", "cs",
  "html", "css", "scss", "json", "yaml", "yml", "toml", "sh", "bash",
]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "avi", "mkv", "webm"]);
const TEXT_EXTENSIONS = new Set(["txt", "md", "mdx", "csv", "log", "xml"]);

function getFileIcon(extension: string) {
  const ext = extension.toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return <FileImage className="size-3.5 shrink-0 text-blue-500" />;
  if (VIDEO_EXTENSIONS.has(ext)) return <FileVideo className="size-3.5 shrink-0 text-purple-500" />;
  if (CODE_EXTENSIONS.has(ext)) return <FileCode className="size-3.5 shrink-0 text-emerald-600" />;
  if (ext === "pdf") return <FileText className="size-3.5 shrink-0 text-orange-500" />;
  if (TEXT_EXTENSIONS.has(ext)) return <FileText className="size-3.5 shrink-0 text-muted-foreground" />;
  return <File className="size-3.5 shrink-0 text-muted-foreground" />;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / 1024 ** exp;
  return `${val.toFixed(val >= 10 || exp === 0 ? 0 : 1)} ${units[exp]}`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function FileMetadataBrowser() {
  const [vaults, setVaults] = useState<VaultRecord[]>([]);
  const [selectedVaultId, setSelectedVaultId] = useState<string | "all">("all");
  const [files, setFiles] = useState<FileEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [extensionFilter, setExtensionFilter] = useState("");
  const [page, setPage] = useState(1);

  const loadVaults = useCallback(async () => {
    const v = await listVaults();
    setVaults(v);
  }, []);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const results = await queryFiles({
        vaultId: selectedVaultId === "all" ? undefined : selectedVaultId,
        search: search.trim() || undefined,
        extension: extensionFilter.trim() || undefined,
      });
      setFiles(results);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }, [selectedVaultId, search, extensionFilter]);

  useEffect(() => {
    void loadVaults();
  }, [loadVaults]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const paged = useMemo(
    () => files.slice(0, page * PAGE_SIZE),
    [files, page]
  );

  const hasMore = paged.length < files.length;

  const extensions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of files) {
      if (f.extension) counts.set(f.extension, (counts.get(f.extension) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [files]);

  function clearFilters() {
    setSearch("");
    setExtensionFilter("");
    setSelectedVaultId("all");
  }

  const hasActiveFilters = search || extensionFilter || selectedVaultId !== "all";

  return (
    <Card className="rounded-3xl shadow-none">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>File browser</CardTitle>
            <CardDescription>
              {loading ? "Loading…" : `${files.length.toLocaleString()} files indexed`}
            </CardDescription>
          </div>
          {hasActiveFilters && (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full text-muted-foreground"
              onClick={clearFilters}
            >
              <X className="size-3.5" />
              Clear filters
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters row */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-full pl-9 h-9"
              placeholder="Search files…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="relative min-w-36">
            <Filter className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-full pl-9 h-9"
              placeholder="Extension…"
              value={extensionFilter}
              onChange={(e) => setExtensionFilter(e.target.value)}
            />
          </div>

          {/* Vault selector */}
          {vaults.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedVaultId("all")}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selectedVaultId === "all"
                    ? "bg-foreground text-background border-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All vaults
              </button>
              {vaults.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVaultId(v.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    selectedVaultId === v.id
                      ? "bg-foreground text-background border-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Extension quick-filters */}
        {extensions.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {extensions.map(([ext, count]) => (
              <button
                key={ext}
                onClick={() =>
                  setExtensionFilter((prev) => (prev === ext ? "" : ext))
                }
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  extensionFilter === ext
                    ? "bg-foreground text-background border-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                .{ext}
                <span className="ml-1 opacity-60">{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-2xl" />
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {vaults.length === 0
              ? "Connect a vault above to see your files here."
              : "No files match the current filters."}
          </div>
        ) : (
          <ScrollArea className="h-[420px] rounded-2xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/40 text-xs text-muted-foreground">
                  <th className="py-2.5 pl-4 pr-2 text-left font-medium">Name</th>
                  <th className="py-2.5 px-2 text-left font-medium hidden sm:table-cell">Path</th>
                  <th className="py-2.5 px-2 text-right font-medium">Size</th>
                  <th className="py-2.5 pl-2 pr-4 text-right font-medium hidden md:table-cell">Modified</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((file) => (
                  <FileRow key={file.id} file={file} vaults={vaults} showVault={selectedVaultId === "all" && vaults.length > 1} />
                ))}
              </tbody>
            </table>

            {hasMore && (
              <div className="flex justify-center p-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setPage((p) => p + 1)}
                >
                  Load more ({(files.length - paged.length).toLocaleString()} remaining)
                </Button>
              </div>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function FileRow({
  file,
  vaults,
  showVault,
}: {
  file: FileEntryRecord;
  vaults: VaultRecord[];
  showVault: boolean;
}) {
  const vault = vaults.find((v) => v.id === file.vaultId);
  const dir = file.relativePath.includes("/")
    ? file.relativePath.substring(0, file.relativePath.lastIndexOf("/"))
    : "";

  return (
    <tr className="border-b last:border-0 hover:bg-secondary/30 transition-colors">
      <td className="py-2.5 pl-4 pr-2 font-medium">
        <div className="flex items-center gap-2 min-w-0">
          {getFileIcon(file.extension)}
          <span className="truncate max-w-[200px]">{file.name}</span>
          {file.extension && (
            <Badge variant="outline" className="rounded-full text-[10px] shrink-0 px-1.5 py-0">
              .{file.extension}
            </Badge>
          )}
        </div>
        {showVault && vault && (
          <p className="mt-0.5 text-xs text-muted-foreground pl-5 truncate">{vault.name}</p>
        )}
      </td>
      <td className="py-2.5 px-2 text-muted-foreground hidden sm:table-cell">
        <span className="truncate block max-w-[220px] text-xs">{dir || "/"}</span>
      </td>
      <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
        {formatBytes(file.size)}
      </td>
      <td className="py-2.5 pl-2 pr-4 text-right text-muted-foreground whitespace-nowrap hidden md:table-cell">
        {formatDate(file.lastModified)}
      </td>
    </tr>
  );
}
