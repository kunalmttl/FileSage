"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderOpen,
  LayoutDashboard,
  MessageSquareText,
  Search,
  Settings2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/",         label: "Home",     icon: LayoutDashboard },
  { href: "/organize", label: "Organize", icon: Sparkles },
  { href: "/search",   label: "Search",   icon: Search },
  { href: "/ask",      label: "Ask",      icon: MessageSquareText },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden w-60 shrink-0 lg:flex flex-col"
      style={{
        background: "rgba(255,255,255,0.55)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        borderRight: "1px solid rgba(34,37,39,0.07)",
        minHeight: "100vh",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      <div className="flex h-full flex-col px-4 py-6">

        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 px-2 py-2 rounded-2xl transition-colors hover:bg-white/40"
        >
          <div
            className="flex size-10 items-center justify-center rounded-2xl"
            style={{
              background: "rgba(221,227,214,0.7)",
              border: "1px solid rgba(195,206,188,0.5)",
            }}
          >
            <FolderOpen className="size-5" style={{ color: "#3D4840" }} />
          </div>
          <div>
            <p
              className="text-sm font-semibold tracking-tight"
              style={{ fontFamily: "Lufga, sans-serif", color: "#222527" }}
            >
              FileSage
            </p>
            <p className="text-xs" style={{ color: "#909D92" }}>
              Local only
            </p>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="mt-8 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-150",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/50"
                )}
                style={
                  active
                    ? {
                        background: "rgba(221,227,214,0.65)",
                        color: "#222527",
                      }
                    : {}
                }
              >
                <Icon
                  className="size-4 shrink-0"
                  style={{ color: active ? "#3D4840" : "#909D92" }}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="mt-auto" />

        {/* Privacy badge card */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: "rgba(232,237,229,0.55)",
            border: "1px solid rgba(195,206,188,0.45)",
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="size-3.5 shrink-0" style={{ color: "#909D92" }} />
            <p
              className="text-xs font-semibold"
              style={{ color: "#3D4840", fontFamily: "Lufga, sans-serif" }}
            >
              Local only
            </p>
          </div>
          <p className="text-xs leading-5" style={{ color: "#7A8580" }}>
            All files, embeddings, and answers stay on your device. No cloud,
            no keys required.
          </p>
        </div>
      </div>
    </aside>
  );
}
