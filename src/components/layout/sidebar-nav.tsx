"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderOpen,
  Home,
  MessageSquareText,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/organize", label: "Organize", icon: Sparkles },
  { href: "/search", label: "Search", icon: Search },
  { href: "/ask", label: "Ask", icon: MessageSquareText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-sidebar/70 px-4 py-5 text-sidebar-foreground lg:block">
      <div className="flex h-full flex-col">
        <Link href="/" className="flex items-center gap-3 rounded-2xl px-2 py-2">
          <div className="flex size-10 items-center justify-center rounded-2xl border bg-card">
            <FolderOpen className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">FileSage</p>
            <p className="text-xs text-muted-foreground">Local only</p>
          </div>
        </Link>

        <nav className="mt-8 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-3xl border bg-card p-4">
          <p className="text-sm font-medium">MVP boundary</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            FileSage is read-only for user files until dry-run quality is
            proven.
          </p>
        </div>
      </div>
    </aside>
  );
}
