import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const PIPELINE_STAGES = [
  "Scanning",
  "Extracting",
  "OCR",
  "Chunking",
  "Embedding",
  "Indexed",
  "Ready",
];

export function PipelineStatus({
  activeStage = "Scanning",
  bare = false,
}: {
  activeStage?: string;
  bare?: boolean;
}) {
  const activeIndex = PIPELINE_STAGES.indexOf(activeStage);

  const stepTrack = (
    <div className="flex items-center gap-0 w-full overflow-x-auto py-2">
      {PIPELINE_STAGES.map((stage, index) => {
        const complete = activeIndex > index;
        const active = activeIndex === index;
        const isLast = index === PIPELINE_STAGES.length - 1;

        return (
          <div key={stage} className="flex items-center" style={{ flex: isLast ? "none" : 1 }}>
            {/* Step node */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-center">
                {complete ? (
                  <CheckCircle2
                    className="size-4"
                    style={{ color: "#909D92" }}
                  />
                ) : active ? (
                  stage === "Ready" ? (
                    <CheckCircle2
                      className="size-4"
                      style={{ color: "#909D92" }}
                    />
                  ) : (
                    <Loader2
                      className="size-4 animate-spin"
                      style={{ color: "#909D92" }}
                    />
                  )
                ) : (
                  <Circle
                    className="size-4"
                    style={{ color: "rgba(34,37,39,0.18)" }}
                  />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] sm:text-xs whitespace-nowrap",
                  complete || active ? "font-medium" : "font-normal"
                )}
                style={{
                  color:
                    complete || active ? "#3D4840" : "rgba(34,37,39,0.35)",
                  fontFamily: "Urbanist, sans-serif",
                }}
              >
                {stage}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className="h-px flex-1 mx-1 sm:mx-2 mb-5"
                style={{
                  background: complete
                    ? "#909D92"
                    : "rgba(34,37,39,0.10)",
                  transition: "background 300ms ease",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  if (bare) {
    return stepTrack;
  }

  return (
    <div
      className="rounded-3xl p-6"
      style={{
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        border: "1px solid rgba(255,255,255,0.88)",
        boxShadow:
          "0 1px 2px rgba(34,37,39,0.04), 0 4px 16px rgba(34,37,39,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
      }}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2
            className="text-base"
            style={{ fontFamily: "Lufga, sans-serif", fontWeight: 500, color: "#222527" }}
          >
            Pipeline status
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "#7A8580" }}>
            Local indexing stages
          </p>
        </div>
        <span className="badge-sage">
          {activeIndex >= PIPELINE_STAGES.length - 1 ? "Ready" : "Indexing"}
        </span>
      </div>

      {stepTrack}
    </div>
  );
}

