import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

export function QuickActionCard({
  href,
  title,
  description,
  icon,
  accent,
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  accent?: "sage" | "dark" | "warm";
}) {
  const iconBg =
    accent === "dark"
      ? "rgba(34,37,39,0.08)"
      : accent === "warm"
      ? "rgba(232,220,200,0.55)"
      : "rgba(221,227,214,0.65)";

  const iconColor =
    accent === "dark"
      ? "#222527"
      : accent === "warm"
      ? "#7A6040"
      : "#3D4840";

  return (
    <Link
      href={href}
      className="group card-hover block rounded-3xl p-5"
      style={{
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        border: "1px solid rgba(255,255,255,0.88)",
        boxShadow:
          "0 1px 2px rgba(34,37,39,0.04), 0 4px 16px rgba(34,37,39,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className="flex size-11 items-center justify-center rounded-2xl"
          style={{ background: iconBg }}
        >
          <span style={{ color: iconColor }}>{icon}</span>
        </div>
        <ArrowRight
          className="size-4 mt-0.5 transition-transform duration-150 group-hover:translate-x-0.5"
          style={{ color: "#C3CEBC" }}
        />
      </div>
      <h2
        className="mt-5 text-sm font-semibold"
        style={{ fontFamily: "Lufga, sans-serif", color: "#222527" }}
      >
        {title}
      </h2>
      <p className="mt-1.5 text-sm leading-6" style={{ color: "#7A8580" }}>
        {description}
      </p>
    </Link>
  );
}
