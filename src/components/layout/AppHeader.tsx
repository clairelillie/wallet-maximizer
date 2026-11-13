"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  onLogoClick?: () => void;
}

export function AppHeader({ onLogoClick }: AppHeaderProps) {
  const pathname = usePathname();
  const onAbout = pathname === "/about";

  return (
    <header className="border-b border-[#a8bdc9] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1512px] items-center justify-between gap-3 px-4 py-3.5 sm:gap-4 sm:px-8 lg:px-[72px]">
        <Link
          href="/"
          onClick={() => onLogoClick?.()}
          className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11.2px] bg-primary">
            <img src="/figma/home/icon.svg" alt="" className="h-4 w-4" />
          </div>
          <p className="truncate text-base font-semibold tracking-tight">
            Wallet Maximizer
          </p>
        </Link>
        <div className="flex items-center gap-3 sm:gap-5">
          <p className="hidden max-w-xs text-right text-sm text-foreground lg:block">
            A few cards. Clear roles. Fees you can justify.
          </p>
          <Link
            href="/about"
            aria-current={onAbout ? "page" : undefined}
            className={cn(
              "rounded-[11.2px] px-3 py-1.5 text-sm font-bold text-foreground outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              onAbout ? "bg-[#e0f2e9]" : "hover:bg-secondary"
            )}
          >
            About
          </Link>
        </div>
      </div>
    </header>
  );
}
