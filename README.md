# Wallet Maximizer

Wallet Maximizer recommends a small credit-card wallet from how you already spend, which benefits you use, and which cards you want to keep. The result is a short list of cards, a job for each one, and an estimate of whether the annual fees pay for themselves.

It is a planning aid for a wallet you can keep using. It does not chase signup bonuses, and it is not financial, tax, or credit advice. Rates, credits, and fees in the catalog can change. Confirm them with the issuer before you apply, keep, or cancel a card.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Answers stay in the browser. There is no account and no database.

```bash
npm test
```

## What you tell it

1. **Wallet.** Cards you already carry. A card that is not in the catalog can be entered by hand. Mark any card you want to keep.
2. **Spend.** A rough monthly amount for dining, groceries, flights, hotels, rental cars, gas, online shopping, and everything else.
3. **Benefits.** How you use lounges, hotels, travel credits, rideshare, food delivery, and similar perks. These answers scale the dollar value of credits. They do not change earn rates.
4. **Preferences.** The most cards you will manage (1–5), which banks you will use, whether you want cash back or points, which rewards strategies you will use, and any airline or hotel programs you care about.

The card limit is a ceiling. The app will recommend fewer cards when extra cards do not improve the estimate.

## How a card gets recommended

The search lives in `src/lib/optimizer.ts`. It builds a short list of cards, scores every wallet that fits your limit, and keeps the one with the highest estimated net value.

```
net value  =  rewards  +  benefits  −  annual fees
```

Rewards and benefits are both dollars per year. A difference of **$40** or less is treated as a tie, and the rules below decide it. A larger gap goes to the higher net value.

### 1. Make a short list

`generateCandidatePool` in `src/lib/engine/candidate-pool.ts` narrows the catalog to about **15** cards so the next step can try combinations.

These cards are always on the list:

- Every card you named.
- Every card you marked must-keep, even when it fails a preference below.

Catalog cards (Chase, Amex, Capital One, and Citi, in `src/catalog/`) have to pass your preferences:

- Bank, unless you chose no preference.
- Cash back or points.
- Rewards strategy: transferable points, travel-portal bookings, or either.
- A path to an airline or hotel program you named, when you named one. A path can be earning that program directly or transferring into it.

If you asked for points, a cash-back card can still join the list when a points card already on the list can convert that cash back into miles.

The remaining seats are filled from three rankings of the same cards: best rewards if that card covered all of your spend alone, best personalized benefit value, then the best combined screening score (`rewards + benefits − fee`). A card that reaches a program you named gets a small boost on that screening score only. The boost does not change the dollar value of the final wallet.

### 2. Score a wallet

`calculateStackValue` in `src/lib/engine/stack-value.ts` scores one set of cards.

**Rewards.** Each spending category goes to the card in that set with the highest earn rate for it. Annual rewards are:

```
monthly spend  ×  12  ×  earn rate  ×  1¢
```

Points and cash back both use **1 cent per point**. That is a fixed modeling choice, not a quote for a particular redemption. If two cards tie, the one earlier in the set keeps the category.

Flights, hotels, and rental cars use the card’s portal rate when you are willing to book through a travel portal, including when you left the strategy as “no preference.” They use the direct-booking rate when you ruled portals out, or when you asked for cash back only. A card you typed in yourself has no portal-versus-direct split. It uses the rates you entered.

**Benefits.** Each catalog credit starts from its stated annual value and is scaled by your benefit answers. Lounge access you rarely use is worth less than the sticker amount. A credit you would not use can land at $0. On the results screen you can replace any of those estimates with your own number and the wallet is scored again.

Some benefits count once per wallet. Lounge access and Priority Pass are the important ones: a second card does not add them again. When a card offers a choice of benefit packages, only the package with the higher total is added.

A card you typed in that is not in the catalog earns from the rates you entered and does not receive catalog credits.

**Fees.** Every card’s annual fee is subtracted, including cards that are only in the wallet because you asked to keep them.

### 3. Try the combinations

`optimizeStackSize` in `src/lib/engine/optimize.ts` tries the wallets that fit.

Must-keep cards are locked in. If you marked more must-keeps than your card limit, all of them stay and the limit gives way.

The search then tries every way to fill the leftover slots from the short list, including leaving slots empty. A new catalog card is allowed into those combinations only when it beats your current wallet’s earn rate in at least one category you actually spend in. Beating the catch-all “everything else” rate is not enough, so a second dining card is not added just because it is slightly better on miscellaneous spend. Cards you already hold can be combined with each other freely.

Each candidate wallet is rejected or kept with these rules, in order:

1. **Points pairing.** If you asked for points, a cash-back card can stay only when a miles card in that same wallet can convert it. A must-keep stays either way.
2. **Second premium card.** A newly recommended premium card, on top of one the wallet already has, must add at least **$300** a year of net value after its fee. Lounge access does not help it clear that bar, because that value was already counted once. A premium card you already hold, or marked must-keep, is not put through this test.
3. **Best net value.** A lead of more than **$40** a year wins. Inside that band, the wallet that keeps more of the cards you already hold wins. A card you hold that changes the total by exactly $0 is not protected, so it can be dropped. If both wallets keep the same number of your cards, the one with more benefit dollars wins.
4. **Still tied.** Prefer the wallet with more cards that both earn rewards on your spend and can reach a program you named. Then prefer fewer cards, then lower total fees.

The current wallet is always one of the candidates when it fits under the limit. An extra card has to beat that, not just fill an empty slot.

### 4. When your current cards win anyway

A stack that follows every preference can be worth less than a stack built only from cards you already hold. If that gap is more than **$40** a year, the recommendation stays with the cards you hold, and the results explain what the preference costs.

The same thing happens when the search result falls more than **$40** behind the cards you already carry for another reason, such as the card limit or the second-premium rule.

### What each recommended card means

- **Keep** means the card is one you already carry, including a must-keep.
- **Add** means it comes from the catalog and you do not carry it yet.
- The categories under a card are the purchases assigned to it.
- Its role (top category, travel, secondary, or catch-all) comes from those assignments.
- The reason it was included is those categories plus the net dollars it adds compared with the same wallet without it.

The app also scores wallets of size 1 through 5 from the same short list. That is how a simpler wallet can be compared with the one that matches the limit you set.

## Where the logic lives

```
src/lib/optimizer.ts                 # Runs the search and the current-wallet comparison
src/lib/engine/candidate-pool.ts     # Short list of about 15 cards
src/lib/engine/optimize.ts           # Combination search and tie-breaks
src/lib/engine/stack-value.ts        # Rewards + benefits − fees
src/lib/engine/rewards.ts            # Assigns each category to one card
src/lib/engine/benefits.ts           # Scales credits from your answers
src/lib/engine/explanations.ts       # Keep/add, role, and the reason text
src/catalog/                         # Earn rates, fees, and credits
```

`src/lib/engine/engine.test.ts` covers the recommendation rules. Edit a catalog file when a fee, earn rate, or credit changes. `npm run catalog:refresh` drafts those edits from issuer pages. It does not apply them on its own. Copy the decline command under a draft you want to keep as-is; the next refresh skips that proposed value. The GitHub Action runs that draft every Monday at 5pm Eastern and emails the review.
