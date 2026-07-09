import type { ReactNode } from "react";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="flex min-h-screen w-full">
        <SidebarNav />
        <main className="min-w-0 flex-1 px-8 py-8 lg:px-10 lg:py-10">
          <div className="max-w-[1200px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
