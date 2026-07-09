import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-3xl px-8 py-16 text-center"
      style={{
        background: "rgba(255,255,255,0.55)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.80)",
        boxShadow:
          "0 1px 2px rgba(34,37,39,0.03), 0 4px 16px rgba(34,37,39,0.04)",
      }}
    >
      {icon && (
        <div
          className="flex size-14 items-center justify-center rounded-2xl mb-5"
          style={{ background: "rgba(221,227,214,0.65)" }}
        >
          <span style={{ color: "#3D4840" }}>{icon}</span>
        </div>
      )}
      <h3
        className="text-base"
        style={{
          fontFamily: "Lufga, sans-serif",
          fontWeight: 500,
          color: "#222527",
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="mt-2 text-sm leading-6 max-w-sm"
          style={{ color: "#7A8580" }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
