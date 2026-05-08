"use client";

import { useEffect, useState } from "react";
import { Activity, Database, HardDrive, Lock, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  clearPerformanceMetrics,
  listPerformanceMetrics,
} from "@/lib/performance/metrics";
import type { PerformanceMetric } from "@/lib/performance/metrics";

const sections = [
  {
    title: "Vault management",
    description: "Reconnect permissions, rescan vaults, and remove stored vault metadata.",
    icon: HardDrive,
  },
  {
    title: "Indexing preferences",
    description: "File type support, OCR toggle, file size limits, and scan rules.",
    icon: Settings2,
  },
  {
    title: "Storage",
    description: "IndexedDB usage, future chunk/vector counts, clear cache, and rebuild index.",
    icon: Database,
  },
  {
    title: "Privacy",
    description: "Local-only status, disabled cloud APIs, and browser permission notes.",
    icon: Lock,
  },
];

export function SettingsWorkspaceShell() {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);

  useEffect(() => {
    const refresh = () => setMetrics(listPerformanceMetrics());
    refresh();
    window.addEventListener("filesage:performance-metrics", refresh);
    return () => window.removeEventListener("filesage:performance-metrics", refresh);
  }, []);

  function clearMetrics() {
    clearPerformanceMetrics();
    setMetrics([]);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <Card key={section.title} className="rounded-3xl shadow-none">
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </div>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="outline" className="rounded-full">
                  Placeholder
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="rounded-3xl shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex size-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <Activity className="size-5" />
            </div>
            <CardTitle>Performance debug</CardTitle>
            <CardDescription>
              Recent local search and pipeline timings for retrieval and indexing operations.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={clearMetrics}
            disabled={!metrics.length}
          >
            Clear
          </Button>
        </CardHeader>
        <CardContent>
          {(() => {
            const searchMetrics = metrics.filter(m => m.kind === 'search');
            const pipelineMetrics = metrics.filter(m => m.kind === 'pipeline');
            
            if (searchMetrics.length === 0 && pipelineMetrics.length === 0) {
              return (
                <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                  Run a search or rescan a vault to capture timing metrics.
                </div>
              );
            }
            
            return (
              <div className="space-y-6">
                {searchMetrics.length > 0 && (
                  <div>
                    <h4 className="mb-3 text-sm font-semibold">Search Timings</h4>
                    <div className="space-y-3">
                      {searchMetrics.slice(0, 8).map((metric) => (
                        <div key={metric.id} className="rounded-2xl border p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{metric.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(metric.createdAt).toLocaleTimeString()} · {metric.totalMs.toFixed(1)} ms
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="secondary" className="rounded-full">
                                {metric.counts.results ?? 0} results
                              </Badge>
                              <Badge variant="outline" className="rounded-full">
                                {metric.counts.files ?? 0} files
                              </Badge>
                              {metric.counts.cachedVectors != null && (
                                <Badge variant="outline" className="rounded-full">
                                  {metric.counts.cachedVectors} vectors
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            {Object.entries(metric.timings).map(([stage, ms]) => (
                              <div key={stage} className="rounded-xl bg-secondary/40 px-3 py-2">
                                <p className="truncate text-[10px] font-medium text-muted-foreground">
                                  {stage}
                                </p>
                                <p className="mt-0.5 font-mono text-xs font-semibold">
                                  {ms.toFixed(1)} ms
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pipelineMetrics.length > 0 && (
                  <div>
                    <h4 className="mb-3 text-sm font-semibold">Pipeline Timings</h4>
                    <div className="space-y-3">
                      {pipelineMetrics.slice(0, 10).map((metric) => (
                        <div key={metric.id} className="rounded-2xl border p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{metric.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(metric.createdAt).toLocaleTimeString()} · {metric.totalMs.toFixed(1)} ms
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {metric.meta && Object.entries(metric.meta).map(([key, value]) => (
                                <Badge key={key} variant="outline" className="rounded-full">
                                  {key}: {typeof value === 'number' ? value.toFixed ? value.toFixed(1) : value : String(value)}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {metric.meta && Object.keys(metric.meta).length > 0 && (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                              {Object.entries(metric.meta).map(([key, value]) => (
                                <div key={key} className="rounded-xl bg-secondary/40 px-3 py-2">
                                  <p className="truncate text-[10px] font-medium text-muted-foreground">
                                    {key}
                                  </p>
                                  <p className="mt-0.5 font-mono text-xs font-semibold">
                                    {typeof value === 'number' ? value.toFixed ? value.toFixed(1) : value : String(value)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
