import { describe, expect, it } from "vitest";
import {
  renderRefreshSummary,
  type CardRefreshResult,
} from "@/lib/catalog-refresh/refresh";

function result(partial: Partial<CardRefreshResult> & Pick<CardRefreshResult, "cardName" | "status">): CardRefreshResult {
  return {
    cardId: partial.cardId ?? "example",
    cardName: partial.cardName,
    sourceUrl: partial.sourceUrl ?? "https://issuer.example/card",
    status: partial.status,
    message: partial.message,
    changes: partial.changes ?? [],
    newBenefits: partial.newBenefits ?? [],
    dismissed: partial.dismissed ?? [],
    rejected: partial.rejected ?? [],
    notes: partial.notes ?? [],
  };
}

describe("renderRefreshSummary", () => {
  it("states a portal rate in words and keeps direct beside it", () => {
    const quote =
      "Earn unlimited 5% cash back on hotels, vacation rentals and rental car bookings";
    const summary = renderRefreshSummary(
      [
        result({
          cardId: "capital-one-savor",
          cardName: "Capital One Savor",
          sourceUrl: "https://www.capitalone.com/credit-cards/savor/",
          status: "proposed_change",
          changes: [
            {
              path: "travelMultipliers.rentalCars.portal",
              current: 1,
              proposed: 5,
              evidence: quote,
            },
            {
              path: "travelMultipliers.hotels.portal",
              current: 1,
              proposed: 5,
              evidence: quote,
            },
          ],
          rejected: [
            {
              path: "travelMultipliers.flights.portal",
              reason: "The quote does not describe flights.",
            },
          ],
        }),
        result({ cardName: "Capital One Venture", status: "no_change" }),
        result({
          cardName: "Citi Custom Cash",
          status: "fetch_failed",
          message: "Issuer page did not include benefit text.",
        }),
      ],
      { ranAt: "2026-11-11T17:00:00.000Z", fetchOnly: false }
    );

    expect(summary).toBe(`# Catalog refresh

Ran 2026-11-11T17:00:00.000Z. Reviewed 3 cards. 1 with proposed changes. 1 could not be read.

## Proposed changes

Copy a command under a change to keep the current catalog value. The next refresh will not propose that value again.

### Capital One Savor

Source: https://www.capitalone.com/credit-cards/savor/

#### Travel earn rates

Hotels and rental cars booked through the portal change from 1 to 5. Direct bookings stay at the catalog rate.

| Category | Portal | Direct |
| --- | --- | --- |
| Hotels | 1 → 5 | unchanged |
| Rental cars | 1 → 5 | unchanged |

To keep the current catalog value:

- Hotels, portal: \`npm run catalog:refresh -- --decline capital-one-savor travelMultipliers.hotels.portal 5\`
- Rental cars, portal: \`npm run catalog:refresh -- --decline capital-one-savor travelMultipliers.rentalCars.portal 5\`

From the page:

> Earn unlimited 5% cash back on hotels, vacation rentals and rental car bookings

#### Not applied

- Flights, portal: The quote does not describe flights.

## No change

Capital One Venture

## Could not read

- **Citi Custom Cash** — Issuer page did not include benefit text.

These are drafts. The catalog files stay as they are until you edit them.`);
  });

  it("groups shared earn rates, fees, and a rate that applies to both booking channels", () => {
    const diningQuote = "Earn 4x points on dining and grocery.";
    const summary = renderRefreshSummary(
      [
        result({
          cardName: "Example Card",
          status: "proposed_change",
          changes: [
            {
              path: "multipliers.grocery",
              current: 3,
              proposed: 4,
              evidence: diningQuote,
            },
            {
              path: "multipliers.dining",
              current: 3,
              proposed: 4,
              evidence: diningQuote,
            },
            {
              path: "annualFee",
              current: 95,
              proposed: 125,
              evidence: "The annual fee is $125.",
            },
            {
              path: "travelMultipliers.flights.portal",
              current: 2,
              proposed: 4,
              evidence: "Earn 4x on flights.",
            },
            {
              path: "travelMultipliers.flights.direct",
              current: 2,
              proposed: 4,
              evidence: "Earn 4x on flights.",
            },
            {
              path: "transferPartners",
              current: ["alaska"],
              proposed: "delta",
              evidence: "Transfer points to Delta SkyMiles.",
            },
            {
              path: "benefits.global-entry.maxAnnualValue",
              current: 30,
              proposed: 120,
              evidence: "Up to $120 every four years for Global Entry.",
            },
          ],
          newBenefits: [
            {
              label: "Example Market credit",
              description: "Up to $50 a year at Example Market.",
              maxAnnualValue: 50,
              valuedBy: "manual",
              stackRule: "each",
              evidence: "Up to $50 in statement credits each year at Example Market.",
            },
          ],
        }),
        result({
          cardName: "Chase Freedom Unlimited",
          status: "no_change",
          notes: ["Lounge access was left unchanged. The refresh does not clear it."],
        }),
      ],
      { ranAt: "2026-11-11T17:00:00.000Z", fetchOnly: false }
    );

    expect(summary).toContain("Dining and grocery change from 3 to 4.");
    expect(summary).toContain("Annual fee changes from $95 to $125.");
    expect(summary).toContain(
      "Flights change from 2 to 4 on both portal and direct bookings."
    );
    expect(summary).toContain("| Flights | 2 → 4 | 2 → 4 |");
    expect(summary).toContain(
      "Delta is added to transfer partners. Already listed: Alaska."
    );
    expect(summary).toContain("Global Entry yearly value changes from $30 to $120.");
    expect(summary).toContain("**Example Market credit** — $50 a year");
    expect(summary).toContain(
      "- **Chase Freedom Unlimited** — Lounge access was left unchanged. The refresh does not clear it."
    );
    expect(summary).not.toContain("`multipliers");
  });

  it("counts a declined proposal without listing it as a change", () => {
    const summary = renderRefreshSummary(
      [
        result({
          cardName: "Capital One Savor",
          status: "no_change",
          dismissed: [{ path: "travelMultipliers.hotels.portal", proposed: 5 }],
        }),
      ],
      { ranAt: "2026-11-11T17:00:00.000Z", fetchOnly: false }
    );

    expect(summary).toContain("0 with proposed changes. 0 could not be read. 1 declined earlier.");
    expect(summary).not.toContain("## Proposed changes");
    expect(summary).not.toContain("1 → 5");
  });

  it("lists fetched pages without a per-card essay", () => {
    const summary = renderRefreshSummary(
      [
        result({
          cardName: "Capital One Savor",
          status: "fetched",
          message: "Read 1200 characters from the issuer page.",
        }),
      ],
      { ranAt: "2026-11-11T17:00:00.000Z", fetchOnly: true }
    );

    expect(summary).toContain("Fetch only: the model was not called.");
    expect(summary).toContain(
      "- **Capital One Savor** — Read 1200 characters from the issuer page."
    );
    expect(summary).not.toContain("## Capital One Savor");
  });
});
