"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreditCardForm } from "./CreditCardForm";
import { EmptyWalletDialog } from "./EmptyWalletDialog";
import type { UserCreditCard } from "@/types";

interface CreditCardListProps {
  cards: UserCreditCard[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<UserCreditCard>) => void;
  onRemove: (id: string) => void;
}

const addButtonClass =
  "h-14 min-h-14 w-full rounded-2xl px-6 text-base font-semibold sm:h-16 sm:min-h-16";

export function CreditCardList({
  cards,
  onAdd,
  onUpdate,
  onRemove,
}: CreditCardListProps) {
  const [pendingRemove, setPendingRemove] = useState<UserCreditCard | null>(
    null
  );

  const requestRemove = (card: UserCreditCard) => {
    if (cards.length === 1) {
      setPendingRemove(card);
      return;
    }
    onRemove(card.id);
  };

  return (
    <div className="space-y-5">
      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card px-5 py-8 text-center sm:px-6">
          <p className="text-base font-medium">No credit cards yet</p>
          <p className="mt-1.5 text-base font-medium leading-relaxed text-muted-foreground">
            That’s fine — we’ll recommend a starter stack from your spend and
            habits. Add a card anytime if you already have one.
          </p>
          <Button type="button" className={`mt-5 ${addButtonClass}`} onClick={onAdd}>
            <Plus className="mr-2 size-5" />
            Add a card
          </Button>
        </div>
      ) : (
        <>
          {cards.map((card, index) => (
            <CreditCardForm
              key={card.id}
              card={card}
              index={index}
              onUpdate={(patch) => onUpdate(card.id, patch)}
              onRemove={() => requestRemove(card)}
              canRemove
            />
          ))}
          <Button
            type="button"
            variant="outline"
            className={addButtonClass}
            onClick={onAdd}
          >
            <Plus className="mr-2 size-5" />
            Add another card
          </Button>
        </>
      )}

      <EmptyWalletDialog
        open={pendingRemove != null}
        cardName={pendingRemove?.name ?? ""}
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => {
          if (pendingRemove) onRemove(pendingRemove.id);
          setPendingRemove(null);
        }}
      />
    </div>
  );
}
