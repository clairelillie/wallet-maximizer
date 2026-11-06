"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const pathname = usePathname();
  const onAbout = pathname === "/about";

  return (
    <header className="border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-3.5">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CreditCard className="h-4 w-4" />
          </div>
          <p className="truncate text-base font-semibold tracking-tight">
            Wallet Maximizer
          </p>
        </Link>
        <div className="flex items-center gap-3 sm:gap-5">
          <p className="hidden max-w-xs text-right text-sm text-muted-foreground lg:block">
            A few cards. Clear roles. Fees you can justify.
          </p>
          <Link
            href="/about"
            aria-current={onAbout ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              onAbout
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            About
          </Link>
        </div>
      </div>
    </header>
  );
}
