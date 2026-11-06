# Wallet Maximizer

MVP web app that recommends an intentional **3–5 card** wallet based on your current cards, spending habits, and preferences. Not a churner tool — focused on simplicity and fee justification.

## Stack

- **Next.js** (App Router)
- **TypeScript**
- **Tailwind CSS v4**
- **shadcn/ui**
- **Local state only** (no auth / database)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout + metadata
│   ├── page.tsx            # Single-page entry
│   └── globals.css         # Theme + fintech styling
├── components/
│   ├── StackOptimizerApp.tsx   # Main client shell
│   ├── inputs/                 # Cards, spending, preferences
│   ├── output/                   # Stack, cheat sheet, fee verdict
│   └── layout/                 # Header
├── hooks/
│   └── useOptimizerState.ts    # Local state + memoized optimize
├── lib/
│   ├── optimizer.ts            # Core recommendation engine
│   ├── card-utils.ts           # Multipliers, spend ranking, valuation
│   └── constants.ts            # Labels, mock catalog, defaults
└── types/
    └── index.ts                # Shared TypeScript types
```

## How optimization works (MVP)

1. Rank spend categories by monthly amount.
2. For each top category, **reuse an already-selected card** if its earn rate is equal to, or within **1x** of, the best available in the pool — avoids redundant cards (e.g. Amex Gold for both dining and groceries at 4x).
3. Only add a new card when no selected card is competitive for that category.
4. Add catch-all if no card in stack earns ≥2x on general spend.
5. Travel/premium cards gated by trip frequency and lounge importance (travel also reuses when competitive).
6. Respect **Keep this card** for portfolio candidates; fill gaps from `MOCK_CARD_CATALOG`.

## Future improvements

| Area | Enhancement |
|------|-------------|
| **Data** | Card database API (T&C, credits, transfer partners) |
| **Auth** | Save stacks, compare history |
| **Optimizer** | Linear programming / knapsack for global optimum |
| **Credits** | User-entered credits + automatic break-even |
| **Transfers** | Point valuations by redemption type |
| **Compliance** | Disclaimers, affiliate disclosure, licensed advice boundaries |
| **UX** | Onboarding wizard, PDF export, mobile PWA |
| **Testing** | Unit tests for `optimizer.ts` edge cases |

## License

Private MVP — not financial advice.
