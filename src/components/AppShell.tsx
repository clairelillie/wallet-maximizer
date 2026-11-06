"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { StackOptimizerApp } from "@/components/StackOptimizerApp";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const onAbout = pathname === "/about";

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      {/* Stay mounted while About is open so in-progress inputs are kept. */}
      <div hidden={onAbout} className="flex-1">
        <StackOptimizerApp />
      </div>
      {onAbout ? <div className="flex-1">{children}</div> : null}
      <footer className="border-t border-border/70 px-4 py-6 text-center text-xs leading-relaxed text-muted-foreground sm:px-6">
        Estimates only. Not financial, tax, or credit advice, and not an offer
        from any issuer. Confirm rates, credits, and fees before you apply,
        keep, or cancel a card.
      </footer>
    </div>
  );
}
