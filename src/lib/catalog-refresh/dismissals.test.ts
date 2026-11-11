import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CARD_CATALOG } from "@/catalog";
import {
  addDismissal,
  newBenefitPath,
  parseProposedValue,
  renderDismissalsFile,
  splitDismissals,
} from "@/lib/catalog-refresh/dismissals";
import type { AcceptedBenefit, AcceptedChange } from "@/lib/catalog-refresh/proposal";

const savor = CARD_CATALOG.find((card) => card.id === "capital-one-savor");
if (!savor) throw new Error("Missing Savor in the catalog");

function change(path: string, proposed: number): AcceptedChange {
  return { path, current: 1, proposed, evidence: "Earn unlimited 5% cash back on hotels." };
}

describe("refresh dismissals", () => {
  it("drops a declined value and keeps a different value for the same field", () => {
    const dismissals = [
      { cardId: savor.id, path: "travelMultipliers.hotels.portal", proposed: 5 },
    ];
    const split = splitDismissals(
      savor.id,
      {
        changes: [
          change("travelMultipliers.hotels.portal", 5),
          change("travelMultipliers.rentalCars.portal", 5),
          change("travelMultipliers.hotels.portal", 10),
        ],
        newBenefits: [],
      },
      dismissals
    );

    expect(split.changes.map((item) => `${item.path}:${item.proposed}`)).toEqual([
      "travelMultipliers.rentalCars.portal:5",
      "travelMultipliers.hotels.portal:10",
    ]);
    expect(split.dismissed).toEqual([
      { path: "travelMultipliers.hotels.portal", proposed: 5 },
    ]);
  });

  it("drops a declined new credit only when the yearly amount matches", () => {
    const label = "Example Market credit";
    const benefit = (maxAnnualValue: number): AcceptedBenefit => ({
      label,
      description: "Up to the cap each year at Example Market.",
      maxAnnualValue,
      valuedBy: "manual",
      stackRule: "each",
      evidence: "Up to $50 in statement credits each year at Example Market.",
    });
    const split = splitDismissals(
      savor.id,
      { changes: [], newBenefits: [benefit(50), benefit(75)] },
      [{ cardId: savor.id, path: newBenefitPath(label), proposed: 50 }]
    );

    expect(split.newBenefits.map((item) => item.maxAnnualValue)).toEqual([75]);
    expect(split.dismissed).toEqual([{ path: newBenefitPath(label), proposed: 50 }]);
  });

  it("records a decline once and rejects a field the refresh does not edit", () => {
    const first = addDismissal([], savor, "travelMultipliers.hotels.portal", parseProposedValue("5"));
    const second = addDismissal(
      first.dismissals,
      savor,
      "travelMultipliers.hotels.portal",
      5
    );
    expect(first.added).toBe(true);
    expect(second.added).toBe(false);
    expect(second.dismissals).toHaveLength(1);
    expect(() => addDismissal([], savor, "multipliers.travel", 5)).toThrow(/not updated by the refresh/);
  });

  it("keeps the committed dismissals file in the same shape the command writes", () => {
    const file = readFileSync("src/catalog/refresh-dismissals.ts", "utf8");
    expect(file).toBe(renderDismissalsFile([]));
  });
});
