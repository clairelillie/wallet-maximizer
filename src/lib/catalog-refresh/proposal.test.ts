import { describe, expect, it } from "vitest";
import { CARD_CATALOG } from "@/catalog";
import { CARD_SOURCE_URLS } from "@/catalog/sources";
import { htmlToText } from "@/lib/catalog-refresh/page-text";
import { guardProposal } from "@/lib/catalog-refresh/proposal";
import type { CatalogCardDefinition } from "@/types";

const page = [
  "Example Card has a $95 annual fee.",
  "Earn 4x points on dining.",
  "Up to $120 every four years for Global Entry.",
  "Transfer points to Delta SkyMiles.",
  "Up to $50 in statement credits each year at Example Market.",
].join(" ");

const card: CatalogCardDefinition = {
  id: "example",
  name: "Example Card",
  annualFee: 95,
  baseMultiplier: 1,
  multipliers: { dining: 3 },
  travelMultipliers: {
    flights: { portal: 1, direct: 1 },
    hotels: { portal: 1, direct: 1 },
    rentalCars: { portal: 1, direct: 1 },
  },
  ecosystem: "chase",
  rewardType: "points",
  isPremium: false,
  hasLoungeAccess: false,
  benefits: [
    {
      id: "ge",
      label: "Global Entry",
      description: "Up to $120 every four years.",
      maxAnnualValue: 30,
      valuedBy: "trustedTraveler",
      stackRule: "once",
      stackGroup: "trustedTraveler",
    },
  ],
};

describe("catalog source URLs", () => {
  it("covers every catalog card with an https page", () => {
    expect(Object.keys(CARD_SOURCE_URLS).sort()).toEqual(
      CARD_CATALOG.map((entry) => entry.id).sort()
    );
    for (const entry of CARD_CATALOG) {
      expect(CARD_SOURCE_URLS[entry.id]).toMatch(/^https:\/\//);
    }
  });
});

describe("htmlToText", () => {
  it("drops scripts and decodes entities", () => {
    const text = htmlToText(
      "<script>secret</script><p>Earn 3x on dining &amp; groceries</p>"
    );
    expect(text).toBe("Earn 3x on dining & groceries");
    expect(text).not.toContain("secret");
  });
});

describe("guardProposal", () => {
  it("accepts an earn-rate change quoted on the page", () => {
    const guarded = guardProposal(card, page, {
      changes: [
        {
          path: "multipliers.dining",
          proposed: 4,
          evidence: "Earn 4x points on dining.",
        },
      ],
    });
    expect(guarded.changes).toEqual([
      {
        path: "multipliers.dining",
        current: 3,
        proposed: 4,
        evidence: "Earn 4x points on dining.",
      },
    ]);
  });

  it("drops a quote that is not on the page", () => {
    const guarded = guardProposal(card, page, {
      changes: [
        {
          path: "annualFee",
          proposed: 195,
          evidence: "The annual fee is $195.",
        },
      ],
    });
    expect(guarded.changes).toEqual([]);
    expect(guarded.rejected[0]?.reason).toMatch(/not on the issuer page/);
  });

  it("annualizes a credit paid every four years", () => {
    const quoted = "Up to $120 every four years for Global Entry.";
    const asFullAmount = guardProposal(card, page, {
      changes: [{ path: "benefits.ge.maxAnnualValue", proposed: 120, evidence: quoted }],
    });
    expect(asFullAmount.changes).toEqual([]);
    expect(asFullAmount.rejected[0]?.reason).toMatch(/divide by 4/);

    const raised = guardProposal(
      { ...card, benefits: [{ ...card.benefits![0], maxAnnualValue: 20 }] },
      page,
      {
        changes: [{ path: "benefits.ge.maxAnnualValue", proposed: 30, evidence: quoted }],
      }
    );
    expect(raised.changes[0]).toMatchObject({ proposed: 30, current: 20 });
  });

  it("adds a transfer partner named in the quote and ignores valuation fields", () => {
    const guarded = guardProposal(card, page, {
      changes: [
        {
          path: "transferPartners",
          proposed: "delta",
          evidence: "Transfer points to Delta SkyMiles.",
        },
        {
          path: "benefits.ge.valuedBy",
          proposed: "manual",
          evidence: "Up to $120 every four years for Global Entry.",
        },
      ],
    });
    expect(guarded.changes.map((change) => change.proposed)).toEqual(["delta"]);
    expect(guarded.rejected).toEqual([]);
  });

  it("adds a new statement credit as a manual benefit", () => {
    const guarded = guardProposal(card, page, {
      newBenefits: [
        {
          label: "Example Market credit",
          description: "Up to $50 a year at Example Market.",
          maxAnnualValue: 50,
          evidence: "Up to $50 in statement credits each year at Example Market.",
        },
      ],
    });
    expect(guarded.newBenefits[0]).toMatchObject({
      maxAnnualValue: 50,
      valuedBy: "manual",
      stackRule: "each",
    });
  });

  it("keeps a direct travel rate on travelMultipliers when it is already stored", () => {
    const preferred: CatalogCardDefinition = {
      ...card,
      multipliers: { dining: 3, grocery: 3, gas: 3 },
      travelMultipliers: {
        flights: { portal: 5, direct: 2 },
        hotels: { portal: 5, direct: 2 },
        rentalCars: { portal: 5, direct: 2 },
      },
    };
    const quote = "2x points on travel worldwide, from airfare and hotels to taxis and trains.";
    const guarded = guardProposal(preferred, quote, {
      changes: [{ path: "multipliers.travel", proposed: 2, evidence: quote }],
    });
    expect(guarded.changes).toEqual([]);
    expect(guarded.rejected).toEqual([]);
  });

  it("writes a portal rate onto travelMultipliers instead of a flat travel multiplier", () => {
    const reserve: CatalogCardDefinition = {
      ...card,
      travelMultipliers: {
        flights: { portal: 5, direct: 4 },
        hotels: { portal: 5, direct: 4 },
        rentalCars: { portal: 5, direct: 4 },
      },
    };
    const quote = "8x points on Chase Travel for flights, hotels, rental cars, cruises, activities and tours.";
    const guarded = guardProposal(reserve, quote, {
      changes: [{ path: "multipliers.travel", proposed: 8, evidence: quote }],
    });
    expect(guarded.changes.map((change) => change.path)).toEqual([
      "travelMultipliers.flights.portal",
      "travelMultipliers.hotels.portal",
      "travelMultipliers.rentalCars.portal",
    ]);
    expect(guarded.changes.every((change) => change.current === 5 && change.proposed === 8)).toBe(
      true
    );
  });

  it("does not write a book-directly rate onto the portal", () => {
    const reserve: CatalogCardDefinition = {
      ...card,
      travelMultipliers: {
        flights: { portal: 8, direct: 4 },
        hotels: { portal: 8, direct: 4 },
        rentalCars: { portal: 8, direct: 4 },
      },
    };
    const quote = "4x points when you book directly with an airline or hotel.";
    const guarded = guardProposal(reserve, quote, {
      changes: [
        { path: "travelMultipliers.hotels.portal", proposed: 4, evidence: quote },
        { path: "travelMultipliers.flights.portal", proposed: 4, evidence: quote },
      ],
    });
    expect(guarded.changes).toEqual([]);
    expect(guarded.rejected).toEqual([]);
  });

  it("puts a book-directly rate on the direct side when that rate is stale", () => {
    const reserve: CatalogCardDefinition = {
      ...card,
      travelMultipliers: {
        flights: { portal: 8, direct: 3 },
        hotels: { portal: 8, direct: 3 },
        rentalCars: { portal: 8, direct: 1 },
      },
    };
    const quote = "4x points when you book directly with an airline or hotel.";
    const guarded = guardProposal(reserve, quote, {
      changes: [
        { path: "travelMultipliers.hotels.portal", proposed: 4, evidence: quote },
        { path: "travelMultipliers.flights.portal", proposed: 4, evidence: quote },
      ],
    });
    expect(guarded.changes).toEqual([
      {
        path: "travelMultipliers.hotels.direct",
        current: 3,
        proposed: 4,
        evidence: quote,
      },
      {
        path: "travelMultipliers.flights.direct",
        current: 3,
        proposed: 4,
        evidence: quote,
      },
    ]);
    expect(guarded.rejected).toEqual([]);
  });

  it("does not apply a select-travel hotel and car-rental rate to flights", () => {
    const venture: CatalogCardDefinition = {
      ...card,
      travelMultipliers: {
        flights: { portal: 2, direct: 2 },
        hotels: { portal: 5, direct: 2 },
        rentalCars: { portal: 5, direct: 2 },
      },
    };
    const quote =
      "Plus, earn a total of 5% on select travel Travel your way and make the most of your vacation with an additional 3% cash back on hotels, car rentals, and at.";
    const guarded = guardProposal(venture, quote, {
      changes: [{ path: "travelMultipliers.flights.portal", proposed: 5, evidence: quote }],
    });
    expect(guarded.changes).toEqual([]);
    expect(guarded.rejected).toEqual([
      {
        path: "travelMultipliers.flights.portal",
        reason: "The quote does not describe flights.",
      },
    ]);
  });

  it("still applies an unqualified portal travel rate to flights", () => {
    const quote = "Earn 5x points on Chase Travel.";
    const guarded = guardProposal(card, quote, {
      changes: [{ path: "multipliers.travel", proposed: 5, evidence: quote }],
    });
    expect(guarded.changes.map((change) => change.path)).toEqual([
      "travelMultipliers.flights.portal",
      "travelMultipliers.hotels.portal",
      "travelMultipliers.rentalCars.portal",
    ]);
    expect(guarded.rejected).toEqual([]);
  });

  it("does not apply a hotels and rental-car portal rate to flights", () => {
    const quote =
      "Earn unlimited 5% cash back on hotels, vacation rentals and rental cars booked through Capital One Travel.";
    const guarded = guardProposal(card, quote, {
      changes: [
        { path: "travelMultipliers.flights.portal", proposed: 5, evidence: quote },
        { path: "travelMultipliers.hotels.portal", proposed: 5, evidence: quote },
        { path: "travelMultipliers.rentalCars.portal", proposed: 5, evidence: quote },
      ],
    });
    expect(guarded.rejected.map((item) => item.path)).toEqual([
      "travelMultipliers.flights.portal",
    ]);
    expect(guarded.changes.map((change) => change.path)).toEqual([
      "travelMultipliers.hotels.portal",
      "travelMultipliers.rentalCars.portal",
    ]);
  });

  it("keeps one airline rate on the flight multiplier when the page has no portal split", () => {
    const southwest: CatalogCardDefinition = {
      ...card,
      multipliers: { dining: 2 },
      travelMultipliers: {
        flights: { portal: 2, direct: 2 },
        hotels: { portal: 2, direct: 2 },
        rentalCars: { portal: 2, direct: 2 },
      },
    };
    const quote =
      "Earn 4 points for each $1 spent on purchases made directly with Southwest Airlines, including flight, inflight, and gift cards.";
    const guarded = guardProposal(southwest, quote, {
      changes: [{ path: "multipliers.flights", proposed: 4, evidence: quote }],
    });
    expect(guarded.changes).toEqual([
      {
        path: "travelMultipliers.flights.portal",
        current: 2,
        proposed: 4,
        evidence: quote,
      },
      {
        path: "travelMultipliers.flights.direct",
        current: 2,
        proposed: 4,
        evidence: quote,
      },
    ]);
  });

  it("keeps a Capital One Travel heading on the portal and lists each rate once", () => {
    const savorPage = [
      "Earn unlimited 3% cash back on dining, entertainment, popular streaming services and at grocery stores.",
      "Book with Capital One Travel Earn unlimited 5% cash back on hotels, vacation rentals and rental car bookings.",
      "Plus, save an average of 15% on flights with price prediction from Capital One Travel.",
    ].join(" ");
    const quote =
      "Earn unlimited 5% cash back on hotels, vacation rentals and rental car bookings";
    const paths = [
      "travelMultipliers.hotels.portal",
      "travelMultipliers.hotels.direct",
      "travelMultipliers.rentalCars.portal",
      "travelMultipliers.rentalCars.direct",
    ];
    const guarded = guardProposal(card, savorPage, {
      changes: [...paths, ...paths].map((path) => ({
        path,
        proposed: 5,
        evidence: quote,
      })),
    });
    expect(guarded.rejected).toEqual([]);
    expect(guarded.changes).toEqual([
      {
        path: "travelMultipliers.hotels.portal",
        current: 1,
        proposed: 5,
        evidence: quote,
      },
      {
        path: "travelMultipliers.rentalCars.portal",
        current: 1,
        proposed: 5,
        evidence: quote,
      },
    ]);
  });

  it("reads a book-directly heading when the rate sentence does not repeat it", () => {
    const quote = "Earn 4x points on flights and hotels.";
    const guarded = guardProposal(card, `Book directly ${quote}`, {
      changes: [
        { path: "travelMultipliers.flights.direct", proposed: 4, evidence: quote },
        { path: "travelMultipliers.hotels.portal", proposed: 4, evidence: quote },
      ],
    });
    expect(guarded.changes.map((change) => change.path)).toEqual([
      "travelMultipliers.flights.direct",
      "travelMultipliers.hotels.direct",
    ]);
    expect(guarded.rejected).toEqual([]);
  });

  it("does not let an earlier portal sentence relabel the next rate", () => {
    const quote = "Earn 4x points on flights and hotels.";
    const guarded = guardProposal(
      card,
      `Earn 8x points on Chase Travel. ${quote}`,
      {
        changes: [
          { path: "travelMultipliers.flights.portal", proposed: 4, evidence: quote },
          { path: "travelMultipliers.hotels.direct", proposed: 4, evidence: quote },
        ],
      }
    );
    expect(guarded.changes.map((change) => change.path)).toEqual([
      "travelMultipliers.flights.portal",
      "travelMultipliers.flights.direct",
      "travelMultipliers.hotels.portal",
      "travelMultipliers.hotels.direct",
    ]);
    expect(guarded.rejected).toEqual([]);
  });

  it("does not clear lounge access", () => {
    const guarded = guardProposal(card, page, {
      changes: [
        {
          path: "hasLoungeAccess",
          proposed: false,
          evidence: "Example Card has a $95 annual fee.",
        },
      ],
    });
    expect(guarded.changes).toEqual([]);
    expect(guarded.notes[0]).toMatch(/left unchanged/);
  });
});
