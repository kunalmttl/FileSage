import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed bg-card/70 p-8 text-center">
      {icon ? (
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-2xl border bg-background">
          {icon}
        </div>
      ) : null}
      <h2 className="text-base font-medium">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
