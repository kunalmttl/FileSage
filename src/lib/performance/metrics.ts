export type PerformanceMetric = {
  id: string;
  kind: "search" | "pipeline";
  label: string;
  createdAt: number;
  totalMs: number;
  counts: Record<string, number>;
  timings: Record<string, number>;
  meta?: Record<string, number | string>;
};

const STORAGE_KEY = "filesage:performance-metrics";
const MAX_METRICS = 50;

// Budget thresholds for pipeline stages (in ms)
const BUDGETS: Record<string, number> = {
  'idb-write:chunks': 300,
  'idb-write:vectors': 300,
  'idb-write:postings': 500,
  'idb-write:files': 300,
  'embedding:batch': 2000,
  'extraction:pdf': 500,
  'extraction:text': 200,
  'scan:total': 10000,
};

export function recordPerformanceMetric(
  metric: Omit<PerformanceMetric, "id" | "createdAt">
): void {
  if (typeof window === "undefined") return;

  const nextMetric: PerformanceMetric = {
    ...metric,
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now(),
  };

  const metrics = [nextMetric, ...listPerformanceMetrics()].slice(0, MAX_METRICS);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics));
  window.dispatchEvent(new CustomEvent("filesage:performance-metrics"));

  // Budget check in development
  if (process.env.NODE_ENV === 'development') {
    const budget = BUDGETS[metric.label];
    if (budget && metric.totalMs > budget) {
      console.warn(
        `[perf:budget] ${metric.label} exceeded budget: ${metric.totalMs.toFixed(1)}ms > ${budget}ms`,
        metric.meta ?? ''
      );
    }
  }
}

export function recordPipelineTiming(
  stage: string,
  durationMs: number,
  meta?: Record<string, number | string>
): void {
  recordPerformanceMetric({
    kind: "pipeline",
    label: stage,
    totalMs: durationMs,
    counts: meta && 'count' in meta ? { count: meta.count as number } : {},
    timings: { [stage]: durationMs },
    meta,
  });
}

export function recordSearchTiming(
  stage: string,
  durationMs: number,
  meta?: Record<string, number | string>
): void {
  recordPerformanceMetric({
    kind: "search",
    label: stage,
    totalMs: durationMs,
    counts: {},
    timings: { [stage]: durationMs },
    meta,
  });
}

export function listPerformanceMetrics(kind?: "search" | "pipeline"): PerformanceMetric[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const all = Array.isArray(parsed) ? parsed : [];
    return kind ? all.filter(m => m.kind === kind) : all;
  } catch {
    return [];
  }
}

export function getPipelineTimings(): PerformanceMetric[] {
  return listPerformanceMetrics("pipeline");
}

export function getSearchTimings(): PerformanceMetric[] {
  return listPerformanceMetrics("search");
}

export function clearPerformanceMetrics(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("filesage:performance-metrics"));
}
