"use client";

import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/lib/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardProvider } from "@/contexts/DashboardContext";
import Navbar from "@/components/Navbar";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <I18nProvider>
        <DashboardProvider>
          <TooltipProvider>
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
          </TooltipProvider>
        </DashboardProvider>
      </I18nProvider>
    </SessionProvider>
  );
}
