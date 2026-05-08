import { computeFingerprint } from "@/features/indexing/fingerprint";
import { listFilesForVault } from "@/lib/db/filesage-db";
import type { FileEntryRecord } from "@/lib/db/types";

export type FileChangeStatus = "new" | "changed" | "unchanged";

export type ClassifiedFile = {
  scannedFile: FileEntryRecord;
  changeStatus: FileChangeStatus;
  existingRecord?: FileEntryRecord;
};

export type ScanClassification = {
  classified: ClassifiedFile[];
  deletedRecords: FileEntryRecord[];
};

export async function classifyScannedFiles(
  vaultId: string,
  scannedFiles: FileEntryRecord[]
): Promise<ScanClassification> {
  const existingRecords = await listFilesForVault(vaultId);
  const existingByPath = new Map(
    existingRecords.map((record) => [record.relativePath, record])
  );
  const scannedPaths = new Set<string>();
  const classified: ClassifiedFile[] = [];

  for (const scannedFile of scannedFiles) {
    scannedPaths.add(scannedFile.relativePath);
    const fingerprint = computeFingerprint(
      scannedFile.relativePath,
      scannedFile.size,
      scannedFile.lastModified
    );
    const existingRecord = existingByPath.get(scannedFile.relativePath);

    if (!existingRecord) {
      classified.push({ scannedFile, changeStatus: "new" });
    } else if (existingRecord.fingerprint !== fingerprint) {
      classified.push({ scannedFile, changeStatus: "changed", existingRecord });
    } else {
      classified.push({ scannedFile, changeStatus: "unchanged", existingRecord });
    }
  }

  const deletedRecords = existingRecords.filter(
    (record) => !scannedPaths.has(record.relativePath)
  );

  return { classified, deletedRecords };
}
