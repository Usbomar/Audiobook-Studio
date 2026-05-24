"use client";

import { Sidebar } from "@/components/sidebar/sidebar";
import { AppProviders } from "@/components/providers/app-providers";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <div className="flex h-screen overflow-hidden bg-[#f7f3eb]">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </AppProviders>
  );
}
