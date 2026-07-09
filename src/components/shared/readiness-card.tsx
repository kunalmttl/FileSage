import { ShieldCheck, HardDrive, Cpu, Cloud } from "lucide-react";

const readinessItems = [
  {
    label: "Folder access",
    value: "Available",
    icon: HardDrive,
    ok: true,
  },
  {
    label: "Local storage",
    value: "IndexedDB v7",
    icon: HardDrive,
    ok: true,
  },
  {
    label: "Workers",
    value: "Embedding & LLM",
    icon: Cpu,
    ok: true,
  },
  {
    label: "Cloud APIs",
    value: "Disabled",
    icon: Cloud,
    ok: false,
  },
];

export function ReadinessCard() {
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
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h2
            className="text-base"
            style={{
              fontFamily: "Lufga, sans-serif",
              fontWeight: 500,
              color: "#222527",
            }}
          >
            System readiness
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "#7A8580" }}>
            Pipeline dependencies
          </p>
        </div>
        <div
          className="flex size-9 items-center justify-center rounded-full"
          style={{ background: "rgba(221,227,214,0.65)" }}
        >
          <ShieldCheck className="size-4" style={{ color: "#3D4840" }} />
        </div>
      </div>

      <div className="space-y-3">
        {readinessItems.map(({ label, value, icon: Icon, ok }) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 py-2.5 px-3 rounded-2xl"
            style={{
              background: "rgba(232,237,229,0.35)",
              border: "1px solid rgba(195,206,188,0.3)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <Icon className="size-3.5 shrink-0" style={{ color: "#909D92" }} />
              <span
                className="text-sm"
                style={{ color: "#3D4840", fontWeight: 500 }}
              >
                {label}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="size-1.5 rounded-full"
                style={{
                  background: ok ? "#909D92" : "rgba(34,37,39,0.2)",
                }}
              />
              <span className="text-xs" style={{ color: "#7A8580" }}>
                {value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
