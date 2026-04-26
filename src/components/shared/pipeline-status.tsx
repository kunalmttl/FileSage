import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const stages = [
  "Scanning",
  "Extracting",
  "OCR",
  "Chunking",
  "Embedding",
  "Indexed",
  "Ready",
];

export function PipelineStatus({ activeStage = "Scanning" }: { activeStage?: string }) {
  const activeIndex = stages.indexOf(activeStage);

  return (
    <div className="rounded-3xl border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium">Pipeline status</h2>
          <p className="text-sm text-muted-foreground">
            Frontend shell for local indexing stages.
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
        {stages.map((stage, index) => {
          const complete = activeIndex > index;
          const active = activeIndex === index;

          return (
            <div
              key={stage}
              className={cn(
                "flex items-center gap-2 rounded-2xl border bg-background px-3 py-2 text-sm",
                active && "border-ring bg-accent/60"
              )}
            >
              {complete ? (
                <CheckCircle2 className="size-4 text-foreground" />
              ) : active ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Circle className="size-4 text-muted-foreground" />
              )}
              <span className="truncate">{stage}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
