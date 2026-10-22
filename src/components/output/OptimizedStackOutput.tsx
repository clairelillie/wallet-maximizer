"use client";

import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORY_LABELS, ROLE_LABELS } from "@/lib/constants";
import type { StackCard } from "@/types";

interface OptimizedStackOutputProps {
  stack: StackCard[];
}

export function OptimizedStackOutput({ stack }: OptimizedStackOutputProps) {
  if (stack.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-muted-foreground">
          No cards matched your criteria. Try adjusting ecosystems or spend inputs.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {stack.map((card, i) => (
        <Card
          key={`${card.id}-${i}`}
          className="overflow-hidden border-border/80 shadow-md transition-shadow hover:shadow-lg"
        >
          <div className="h-1 bg-gradient-to-r from-brand via-primary to-gain" />
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {ROLE_LABELS[card.role] ?? card.role}
                </p>
                <CardTitle className="mt-1 text-lg">{card.name}</CardTitle>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {card.isNewRecommendation && (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    Suggested add
                  </Badge>
                )}
                {card.isFromUserPortfolio && !card.isNewRecommendation && (
                  <Badge variant="outline">From your wallet</Badge>
                )}
                {card.annualFee > 0 ? (
                  <Badge variant="outline">${card.annualFee}/yr</Badge>
                ) : (
                  <Badge variant="outline">No annual fee</Badge>
                )}
                {card.coveredCategories.length > 1 && (
                  <Badge variant="secondary">
                    {card.coveredCategories.length} categories
                  </Badge>
                )}
              </div>
            </div>
            {card.coveredCategories.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Covers:{" "}
                {card.coveredCategories
                  .map((c) => CATEGORY_LABELS[c])
                  .join(" · ")}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium text-foreground">Why it was chosen</p>
              <p className="mt-1 text-muted-foreground">{card.whyChosen}</p>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2.5">
              <p className="font-medium text-foreground">Suggested usage</p>
              <p className="mt-0.5 text-muted-foreground">{card.suggestedUsage}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
