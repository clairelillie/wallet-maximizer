"use client";

import { Calculator } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ResultsPlaceholderProps {
  title?: string;
  message?: string;
}

export function ResultsPlaceholder({
  title = "Results not calculated yet",
  message = "Add your cards and spending, then click Calculate my stack to see recommendations.",
}: ResultsPlaceholderProps) {
  return (
    <Card className="border-dashed border-border/80">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Calculator className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}
