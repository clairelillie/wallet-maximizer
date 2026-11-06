"use client";

import { useState } from "react";
import { CARD_CATALOG } from "@/catalog";
import { CATALOG_ISSUER_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { PreferredEcosystem } from "@/types";

export function CatalogBrowser() {
  const [selected, setSelected] = useState<PreferredEcosystem>(
    CATALOG_ISSUER_OPTIONS[0]?.value ?? "chase"
  );
  const issuer =
    CATALOG_ISSUER_OPTIONS.find((option) => option.value === selected) ??
    CATALOG_ISSUER_OPTIONS[0];
  const cards = CARD_CATALOG.filter((card) => card.ecosystem === issuer?.value);

  return (
    <section className="rounded-2xl border border-border bg-card px-5 py-6 sm:px-8 sm:py-10">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
        Cards in the catalog
      </h2>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Recommendations draw from a curated set of widely held cards. It is a
        starting catalog, not the whole market.
      </p>

      <div
        className="mt-6 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Card issuers"
      >
        {CATALOG_ISSUER_OPTIONS.map((option) => {
          const active = option.value === issuer?.value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              id={`issuer-tab-${option.value}`}
              aria-selected={active}
              aria-controls="issuer-card-panel"
              onClick={() => setSelected(option.value)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active
                  ? "border-brand bg-brand-soft text-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="issuer-card-panel"
        aria-labelledby={issuer ? `issuer-tab-${issuer.value}` : undefined}
        className="mt-5"
      >
        {issuer ? (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {cards.map((card) => (
              <li
                key={card.id}
                className="px-4 py-3 text-sm font-medium sm:text-base"
              >
                {card.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No issuers are in the catalog yet.
          </p>
        )}
      </div>

      <p className="mt-5 text-base leading-relaxed text-muted-foreground">
        New suggestions stay inside this catalog. A card you already hold can
        still be entered on its own, and if another card fits you better, use
        that one.
      </p>
    </section>
  );
}
