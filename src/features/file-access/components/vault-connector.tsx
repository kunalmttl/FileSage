"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Database,
  FolderOpen,
  HardDrive,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import {
  canUseDirectoryPicker,
  createUploadFallbackVault,
  pickDirectoryVault,
  queryDirectoryReadPermission,
  requestDirectoryReadPermission,
} from "@/features/file-access/picker";
import { extractAndChunkFiles } from "@/features/extraction/extract-pipeline";
import type { ExtractionProgress } from "@/features/extraction/extract-pipeline";
import { embedChunks } from "@/features/embeddings/embed-pipeline";
import type { EmbedProgress } from "@/features/embeddings/embed-pipeline";
import type { ScanProgress } from "@/features/indexing/scanner";
import { classifyScannedFiles } from "@/features/indexing/scan-classifier";
import {
  scanDirectoryHandleVault,
  scanUploadedFolderVault,
} from "@/features/indexing/scanner";
import {
  clearChunksForVault,
  clearFilesForVault,
  clearLexicalIndexForVault,
  clearVectorsForVault,
  deleteFileAndDependents,
  deleteVault,
  listChunksForFile,
  listChunksForVault,
  listVaults,
  saveFileBatch,
  saveVault,
  updateVaultScanStats,
} from "@/lib/db/filesage-db";
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
import { Separator } from "@/components/ui/separator";
import { PipelineStatus } from "@/components/shared/pipeline-status";
import { ReadinessCard } from "@/components/shared/readiness-card";

type ConnectorStatus =
  | "idle"
  | "scanning"
  | "classifying"
  | "cleaning"
  | "extracting"
  | "embedding"
  | "complete"
  | "error";

const EMPTY_SCAN: ScanProgress = { filesScanned: 0, totalBytes: 0 };
const EMPTY_EXTRACTION: ExtractionProgress = {
  processed: 0,
  extracted: 0,
  skipped: 0,
  chunks: 0,
};
const EMPTY_EMBED: EmbedProgress = { processed: 0, total: 0, stage: "loading" };

type ClassificationSummary = {
  new: number;
  changed: number;
  unchanged: number;
  deleted: number;
};

const EMPTY_CLASSIFICATION: ClassificationSummary = {
  new: 0,
  changed: 0,
  unchanged: 0,
  deleted: 0,
};

export function VaultConnector() {
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const [directoryPickerSupported, setDirectoryPickerSupported] = useState(false);
  const [vaults, setVaults] = useState<VaultRecord[]>([]);
  const [status, setStatus] = useState<ConnectorStatus>("idle");
  const [scanProgress, setScanProgress] = useState<ScanProgress>(EMPTY_SCAN);
  const [extractionProgress, setExtractionProgress] =
    useState<ExtractionProgress>(EMPTY_EXTRACTION);
  const [embedProgress, setEmbedProgress] = useState<EmbedProgress>(EMPTY_EMBED);
  const [classification, setClassification] =
    useState<ClassificationSummary>(EMPTY_CLASSIFICATION);
  const [totalFilesToProcess, setTotalFilesToProcess] = useState(0);
  const [message, setMessage] = useState("No vault connected yet.");
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    queueMicrotask(() => setDirectoryPickerSupported(canUseDirectoryPicker()));
    if (fallbackInputRef.current) {
      fallbackInputRef.current.setAttribute("webkitdirectory", "");
      fallbackInputRef.current.setAttribute("directory", "");
    }
    void refreshVaults();
  }, []);

  async function refreshVaults() {
    const saved = await listVaults();
    const checked = await Promise.all(
      saved.map(async (v) => {
        if (!v.handle) return v;
        try {
          return { ...v, permissionState: await queryDirectoryReadPermission(v.handle) };
        } catch {
          return { ...v, permissionState: "denied" as const };
        }
      })
    );
    setVaults(checked);
  }

  async function runExtraction(files: FileEntryRecord[], vaultName: string) {
    setStatus("extracting");
    setExtractionProgress(EMPTY_EXTRACTION);
    setMessage(`Extracting text from ${vaultName}.`);
    return extractAndChunkFiles(files, {
      onProgress: (p) => {
        setExtractionProgress({ ...p });
        if (p.currentPath) setMessage(`Extracting: ${p.currentPath}`);
      },
    });
  }

  async function runEmbedding(vaultId: string, vaultName: string, fileIds?: string[]) {
    setStatus("embedding");
    setEmbedProgress(EMPTY_EMBED);
    setMessage(`Embedding chunks for ${vaultName}.`);
    const chunks = fileIds
      ? (await Promise.all(fileIds.map((fileId) => listChunksForFile(fileId)))).flat()
      : await listChunksForVault(vaultId);
    if (chunks.length === 0) return { embedded: 0, failed: 0 };
    return embedChunks(chunks, {
      onProgress: (p) => {
        setEmbedProgress({ ...p });
        if (p.message) setMessage(p.message);
      },
    });
  }

  async function connectDirectoryVault() {
    setStatus("scanning");
    setError(undefined);
    setScanProgress(EMPTY_SCAN);
    setExtractionProgress(EMPTY_EXTRACTION);
    setEmbedProgress(EMPTY_EMBED);
    setClassification(EMPTY_CLASSIFICATION);
    setTotalFilesToProcess(0);
    setMessage("Waiting for folder selection.");
    try {
      const picked = await pickDirectoryVault();
      const perm = await requestDirectoryReadPermission(picked.handle!);
      if (perm !== "granted") {
        await saveVault({ ...picked, permissionState: perm });
        await refreshVaults();
        setStatus("error");
        setError("Read permission was not granted for this vault.");
        return;
      }
      const vault = { ...picked, permissionState: perm };
      await saveVault(vault);
      await Promise.all([
        clearFilesForVault(vault.id),
        clearChunksForVault(vault.id),
        clearVectorsForVault(vault.id),
        clearLexicalIndexForVault(vault.id),
      ]);
      setMessage(`Scanning ${vault.name}.`);
      const scannedFiles: FileEntryRecord[] = [];
      const result = await scanDirectoryHandleVault(vault, {
        onProgress: setScanProgress,
        onBatch: async (batch) => { scannedFiles.push(...batch); await saveFileBatch(batch); },
      });
      await updateVaultScanStats(vault.id, result.stats);
      setTotalFilesToProcess(scannedFiles.length);
      const extraction = await runExtraction(scannedFiles, vault.name);
      const embed = await runEmbedding(vault.id, vault.name, scannedFiles.map((file) => file.id));
      await refreshVaults();
      setStatus("complete");
      setMessage(
        `Done. ${result.stats.fileCount.toLocaleString()} files, ${extraction.extracted} extracted, ${embed.embedded} chunks embedded.`
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStatus("idle");
        setMessage("Folder selection cancelled.");
        return;
      }
      setStatus("error");
      setError(err instanceof Error ? err.message : "Vault connection failed.");
    }
  }

  async function connectFallbackVault(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setStatus("scanning");
    setError(undefined);
    setScanProgress(EMPTY_SCAN);
    setExtractionProgress(EMPTY_EXTRACTION);
    setEmbedProgress(EMPTY_EMBED);
    setClassification(EMPTY_CLASSIFICATION);
    setTotalFilesToProcess(0);
    try {
      const vault = createUploadFallbackVault(fileList);
      await saveVault(vault);
      await Promise.all([
        clearFilesForVault(vault.id),
        clearChunksForVault(vault.id),
        clearVectorsForVault(vault.id),
        clearLexicalIndexForVault(vault.id),
      ]);
      setMessage(`Scanning ${vault.name}.`);
      const result = await scanUploadedFolderVault(vault, fileList, {
        onProgress: setScanProgress,
        onBatch: saveFileBatch,
      });
      await updateVaultScanStats(vault.id, result.stats);
      setTotalFilesToProcess(result.files.length);
      const extraction = await runExtraction(result.files, vault.name);
      const embed = await runEmbedding(vault.id, vault.name, result.files.map((file) => file.id));
      await refreshVaults();
      setStatus("complete");
      setMessage(
        `Done. ${result.stats.fileCount.toLocaleString()} files, ${extraction.extracted} extracted, ${embed.embedded} chunks embedded.`
      );
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Fallback folder scan failed.");
    } finally {
      if (fallbackInputRef.current) fallbackInputRef.current.value = "";
    }
  }

  async function removeVault(vault: VaultRecord) {
    if (!window.confirm(`Remove "${vault.name}"? This deletes all indexed files and chunks.`)) return;
    await deleteVault(vault.id);
    await refreshVaults();
    setMessage(`"${vault.name}" removed.`);
  }

  async function rescanVault(vault: VaultRecord) {
    if (!vault.handle) {
      setError("Fallback vaults must be uploaded again to rescan.");
      return;
    }
    setStatus("scanning");
    setError(undefined);
    setScanProgress(EMPTY_SCAN);
    setExtractionProgress(EMPTY_EXTRACTION);
    setEmbedProgress(EMPTY_EMBED);
    setClassification(EMPTY_CLASSIFICATION);
    setTotalFilesToProcess(0);
    try {
      const perm = await requestDirectoryReadPermission(vault.handle);
      if (perm !== "granted") {
        await saveVault({ ...vault, permissionState: perm });
        await refreshVaults();
        setStatus("error");
        setError("Read permission was not granted for this vault.");
        return;
      }
      const v = { ...vault, permissionState: perm };
      await saveVault(v);
      setMessage(`Rescanning ${v.name}.`);
      const result = await scanDirectoryHandleVault(v, {
        onProgress: setScanProgress,
      });

      setStatus("classifying");
      setMessage(`Classifying changes in ${v.name}.`);
      const { classified, deletedRecords } = await classifyScannedFiles(v.id, result.files);
      const newFiles = classified.filter((file) => file.changeStatus === "new");
      const changedFiles = classified.filter((file) => file.changeStatus === "changed");
      const unchangedFiles = classified.filter((file) => file.changeStatus === "unchanged");
      const summary = {
        new: newFiles.length,
        changed: changedFiles.length,
        unchanged: unchangedFiles.length,
        deleted: deletedRecords.length,
      };
      setClassification(summary);

      const recordsToDelete = [
        ...deletedRecords,
        ...changedFiles.flatMap((file) => file.existingRecord ? [file.existingRecord] : []),
      ];
      if (recordsToDelete.length > 0) {
        setStatus("cleaning");
        setMessage(`Cleaning ${recordsToDelete.length.toLocaleString()} changed or deleted files.`);
        await Promise.all(recordsToDelete.map((record) => deleteFileAndDependents(record)));
      }

      await updateVaultScanStats(v.id, result.stats);
      const filesToProcess = [...newFiles, ...changedFiles].map((file) => file.scannedFile);
      if (filesToProcess.length === 0) {
        await refreshVaults();
        setStatus("complete");
        setMessage(
          `Done. ${unchangedFiles.length.toLocaleString()} files unchanged, nothing to re-index.`
        );
        return;
      }

      await saveFileBatch(filesToProcess);
      setTotalFilesToProcess(filesToProcess.length);
      const extraction = await runExtraction(filesToProcess, v.name);
      const embed = await runEmbedding(v.id, v.name, filesToProcess.map((file) => file.id));
      await refreshVaults();
      setStatus("complete");
      setMessage(
        `Done. ${filesToProcess.length.toLocaleString()} changed files indexed, ${unchangedFiles.length.toLocaleString()} skipped, ${extraction.extracted} extracted, ${embed.embedded} chunks embedded.`
      );
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Vault rescan failed.");
    }
  }

  const busy = ["scanning", "classifying", "cleaning", "extracting", "embedding"].includes(status) || isPending;

  const activePipelineStage = (() => {
    if (status === "scanning") return "Scanning";
    if (status === "classifying" || status === "cleaning") return "Scanning";
    if (status === "extracting") {
      if (totalFilesToProcess <= 0) return "Extracting";
      const ratio = extractionProgress.processed / totalFilesToProcess;
      if (ratio < 0.4) return "Extracting";
      if (ratio < 0.7) return "OCR";
      return "Chunking";
    }
    if (status === "embedding") {
      if (embedProgress.stage === "loading") return "Embedding";
      if (embedProgress.processed < embedProgress.total) return "Embedding";
      return "Indexed";
    }
    if (status === "complete") return "Ready";
    if (status === "idle" && vaults.length > 0) return "Ready";
    return "Scanning";
  })();

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_380px] items-start">
      <Card className="rounded-3xl shadow-none">
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <FolderOpen className="size-5" />
          </div>
          <CardTitle>Vault connection</CardTitle>
          <CardDescription>
            Connect local folders and store the file metadata snapshot in IndexedDB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="rounded-full"
              disabled={!directoryPickerSupported || busy}
              onClick={() => startTransition(() => { void connectDirectoryVault(); })}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <FolderOpen />}
              Select vault
            </Button>
            <Button
              className="rounded-full"
              variant="outline"
              disabled={busy}
              onClick={() => fallbackInputRef.current?.click()}
            >
              <Upload />
              Upload folder
            </Button>
            <input
              ref={fallbackInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { void connectFallbackVault(e.currentTarget.files); }}
            />
          </div>

          {/* Scan metrics */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Files scanned" value={scanProgress.filesScanned.toLocaleString()} />
            <Metric label="Stored" value={formatBytes(scanProgress.totalBytes)} />
            <Metric
              label="Status"
              value={
                status === "scanning" ? "Scanning…"
                  : status === "classifying" ? "Classifying…"
                  : status === "cleaning" ? "Cleaning…"
                  : status === "extracting" ? "Extracting…"
                  : status === "embedding" ? "Embedding…"
                  : statusLabel(status)
              }
            />
          </div>

          {(classification.new > 0 ||
            classification.changed > 0 ||
            classification.unchanged > 0 ||
            classification.deleted > 0) && (
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="Unchanged" value={classification.unchanged.toLocaleString()} />
              <Metric label="New" value={classification.new.toLocaleString()} />
              <Metric label="Changed" value={classification.changed.toLocaleString()} />
              <Metric label="Deleted" value={classification.deleted.toLocaleString()} />
            </div>
          )}

          {/* Extraction metrics */}
          {(status === "extracting" || status === "embedding" || extractionProgress.processed > 0) && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Processed" value={extractionProgress.processed.toLocaleString()} />
              <Metric label="Extracted" value={extractionProgress.extracted.toLocaleString()} />
              <Metric label="Chunks" value={extractionProgress.chunks.toLocaleString()} />
            </div>
          )}

          {/* Embedding metrics */}
          {(status === "embedding" || embedProgress.processed > 0) && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric
                label="Embedded"
                value={`${embedProgress.processed} / ${embedProgress.total}`}
              />
              <Metric
                label="Stage"
                value={embedProgress.stage === "loading" ? "Loading model…" : embedProgress.stage === "embedding" ? "Embedding…" : "Done"}
              />
              <Metric label="Vectors" value={embedProgress.processed.toLocaleString()} />
            </div>
          )}

          {/* Indexing pipeline step track */}
          <div className="rounded-2xl border bg-card/40 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Indexing Pipeline</p>
            <PipelineStatus bare activeStage={activePipelineStage} />
          </div>

          <div className="rounded-2xl border bg-secondary/60 p-4">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{message}</p>
                {status === "scanning" && scanProgress.currentPath ? (
                  <p className="truncate text-sm text-muted-foreground">
                    {scanProgress.currentPath}
                  </p>
                ) : null}
                {error ? (
                  <p className="mt-2 text-sm text-destructive">{error}</p>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5 w-full">
        <Card className="rounded-3xl shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Connected vaults</CardTitle>
                <CardDescription>Saved locally in this browser.</CardDescription>
              </div>
              <Button
                size="icon"
                variant="outline"
                disabled={busy}
                onClick={() => { void refreshVaults(); }}
                aria-label="Refresh vaults"
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {vaults.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                No vault metadata is stored yet.
              </div>
            ) : (
              vaults.map((vault) => (
                <VaultRow
                  key={vault.id}
                  vault={vault}
                  disabled={busy}
                  onRescan={() => { void rescanVault(vault); }}
                  onRemove={() => { void removeVault(vault); }}
                />
              ))
            )}
          </CardContent>
        </Card>
        <ReadinessCard />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function VaultRow({
  vault,
  disabled,
  onRescan,
  onRemove,
}: {
  vault: VaultRecord;
  disabled: boolean;
  onRescan: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <HardDrive className="size-4 shrink-0 text-muted-foreground" />
            <p className="truncate text-sm font-medium">{vault.name}</p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {vault.fileCount.toLocaleString()} files · {formatBytes(vault.totalBytes)}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 rounded-full">
          {vault.source === "directory-picker" ? vault.permissionState : "fallback"}
        </Badge>
      </div>
      <Separator className="my-3" />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          {vault.lastScannedAt
            ? new Date(vault.lastScannedAt).toLocaleString()
            : "Not scanned"}
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={disabled || !vault.handle}
            onClick={onRescan}
          >
            <RefreshCw className="size-3.5" />
            Rescan
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full text-destructive hover:text-destructive"
            disabled={disabled}
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function statusLabel(status: ConnectorStatus): string {
  if (status === "complete") return "Complete";
  if (status === "error") return "Needs attention";
  return "Idle";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / 1024 ** exp;
  return `${val.toFixed(val >= 10 || exp === 0 ? 0 : 1)} ${units[exp]}`;
}
