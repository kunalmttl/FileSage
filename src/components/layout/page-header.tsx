import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl space-y-2">
        {eyebrow && (
          <p className="eyebrow">{eyebrow}</p>
        )}
        <h1
          className="text-4xl tracking-tight"
          style={{
            fontFamily: "Lufga, sans-serif",
            fontWeight: 500,
            color: "#222527",
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            className="text-sm leading-6 max-w-xl"
            style={{ color: "#7A8580" }}
          >
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
