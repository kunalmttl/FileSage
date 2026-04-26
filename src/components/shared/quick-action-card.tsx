import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

export function QuickActionCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl border bg-card p-4 transition-colors hover:bg-secondary/70"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          {icon}
        </div>
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <h2 className="mt-4 text-sm font-medium">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </Link>
  );
}
