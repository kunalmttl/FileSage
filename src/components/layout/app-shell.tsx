import type { ReactNode } from "react";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl">
        <SidebarNav />
        <main className="min-w-0 flex-1 px-5 py-6 sm:px-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
