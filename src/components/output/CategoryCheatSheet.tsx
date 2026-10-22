"use client";

import { ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CategoryAssignment } from "@/types";

interface CategoryCheatSheetProps {
  assignments: CategoryAssignment[];
}

export function CategoryCheatSheet({ assignments }: CategoryCheatSheetProps) {
  const active = assignments.filter(
    (a) => a.monthlySpend > 0 || a.category === "other"
  );

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Category cheat sheet</CardTitle>
        <CardDescription>
          Pin this mentally — one card per category. Annual $ assumes ~1¢ per
          point from your multiplier.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border/60">
          {active.map((row) => (
            <li
              key={row.category}
              className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <span className="font-medium text-foreground">{row.label}</span>
                {row.monthlySpend > 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    ${row.monthlySpend.toLocaleString()}/mo × {row.multiplier}x
                    = ${row.annualReward.toLocaleString()}/yr
                  </p>
                )}
              </div>
              <span className="flex items-center gap-2 text-muted-foreground">
                <ArrowRight className="hidden h-4 w-4 shrink-0 sm:block" />
                <span>
                  <span className="font-semibold text-foreground">
                    {row.cardName}
                  </span>
                  <span className="ml-2 text-xs">({row.multiplier}x)</span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
