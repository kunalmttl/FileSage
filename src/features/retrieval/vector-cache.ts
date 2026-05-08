import { listAllVectors } from "@/lib/db/filesage-db";

export type CachedVector = {
  chunkId: string;
  fileId: string;
  vaultId: string;
  vector: Float32Array;
};

const vectorCache = new Map<string, CachedVector[]>();
const pendingLoads = new Map<string, Promise<CachedVector[]>>();

function cacheKey(vaultId?: string): string {
  return vaultId ?? "__all__";
}

export async function loadVectorCache(vaultId?: string): Promise<CachedVector[]> {
  const key = cacheKey(vaultId);
  const cached = vectorCache.get(key);
  if (cached) return cached;

  const pending = pendingLoads.get(key);
  if (pending) return pending;

  const load = listAllVectors(vaultId)
    .then((records) => {
      const vectors = records.map((record) => ({
        chunkId: record.id,
        fileId: record.fileId,
        vaultId: record.vaultId,
        vector: Float32Array.from(record.vector),
      }));

      vectorCache.set(key, vectors);
      pendingLoads.delete(key);
      return vectors;
    })
    .catch((error) => {
      pendingLoads.delete(key);
      throw error;
    });

  pendingLoads.set(key, load);
  return load;
}

export function getCachedVectors(vaultId?: string): CachedVector[] | undefined {
  return vectorCache.get(cacheKey(vaultId));
}

export function invalidateVectorCache(vaultId?: string): void {
  if (vaultId) {
    vectorCache.delete(cacheKey(vaultId));
    vectorCache.delete(cacheKey());
    pendingLoads.delete(cacheKey(vaultId));
    pendingLoads.delete(cacheKey());
    return;
  }

  vectorCache.clear();
  pendingLoads.clear();
}
