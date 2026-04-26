import { Badge } from "@/components/ui/badge";

const readinessItems = [
  ["Folder access", "Available through picker/fallback"],
  ["Local storage", "IndexedDB metadata store"],
  ["Workers", "Pending extraction and embeddings"],
  ["Cloud APIs", "Disabled"],
];

export function ReadinessCard() {
  return (
    <div className="rounded-3xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">System readiness</h2>
          <p className="text-sm text-muted-foreground">
            Capabilities the local pipeline depends on.
          </p>
        </div>
        <Badge variant="secondary" className="rounded-full">
          Local
        </Badge>
      </div>
      <div className="mt-4 space-y-3">
        {readinessItems.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
