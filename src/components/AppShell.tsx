"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { StackOptimizerApp } from "@/components/StackOptimizerApp";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const onAbout = pathname === "/about";
  const goHomeRef = useRef<() => void>(() => {});

  const registerGoHome = useCallback((goHome: () => void) => {
    goHomeRef.current = goHome;
  }, []);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
      <AppHeader onLogoClick={() => goHomeRef.current()} />
      {/* Stay mounted while About is open so in-progress inputs are kept. */}
      <div hidden={onAbout} className="flex-1">
        <StackOptimizerApp registerGoHome={registerGoHome} />
      </div>
      {onAbout ? <div className="flex-1">{children}</div> : null}
      <footer className="border-t border-border bg-card px-4 py-7 text-center text-xs leading-5 text-foreground sm:px-6">
        Estimates only. Not financial, tax, or credit advice, and not an offer
        from any issuer. Confirm rates, credits, and fees before you apply,
        keep, or cancel a card.
      </footer>
    </div>
  );
}
