export function computeFingerprint(
  relativePath: string,
  size: number,
  lastModified: number
): string {
  return `${relativePath}::${size}::${lastModified}`;
}
