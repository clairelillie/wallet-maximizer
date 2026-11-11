import { writeFile } from "node:fs/promises";
import path from "node:path";
import { CARD_CATALOG } from "../src/catalog";
import { REFRESH_DISMISSALS } from "../src/catalog/refresh-dismissals";
import {
  addDismissal,
  parseProposedValue,
  renderDismissalsFile,
} from "../src/lib/catalog-refresh/dismissals";
import { refreshCatalog } from "../src/lib/catalog-refresh/refresh";

/**
 * Draft a catalog review from each card's issuer page.
 *
 *   npm run catalog:refresh
 *   npm run catalog:refresh -- --card amex-gold
 *   npm run catalog:refresh -- --fetch-only
 *   npm run catalog:refresh -- --decline capital-one-savor travelMultipliers.hotels.portal 5
 *
 * Set OPENAI_API_KEY. Optional CATALOG_REFRESH_MODEL (default gpt-4.1-mini).
 * Writes catalog-reviews/ and does not edit src/catalog.
 * --decline records that the current catalog value is right. Commit
 * src/catalog/refresh-dismissals.ts so the next refresh skips that proposal.
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.declines.length > 0) {
    if (args.fetchOnly || (args.cardIds?.length ?? 0) > 0) {
      throw new Error("Pass --decline on its own. It records a review decision and does not call the model.");
    }
    await recordDeclines(args.declines);
    return;
  }
  if (!args.fetchOnly && !process.env.OPENAI_API_KEY) {
    console.error(
      "Set OPENAI_API_KEY to draft catalog changes. Source links are already stored. Pass --fetch-only to check the issuer pages without a model."
    );
    process.exit(1);
  }

  const report = await refreshCatalog({
    cardIds: args.cardIds,
    fetchOnly: args.fetchOnly,
  });
  console.log(report.summary);
  console.log(`\nWrote ${report.directory}`);

  const failed = report.results.filter(
    (result) => result.status === "fetch_failed" || result.status === "model_failed"
  );
  if (failed.length === report.results.length) process.exit(1);
}

function parseArgs(argv: string[]) {
  const cardIds: string[] = [];
  const declines: Array<{ cardId: string; path: string; proposed: string }> = [];
  let fetchOnly = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--fetch-only") {
      fetchOnly = true;
    } else if (arg === "--card") {
      const id = argv[++i];
      if (!id) throw new Error("--card requires a catalog id");
      cardIds.push(id);
    } else if (arg === "--decline") {
      const cardId = argv[++i];
      const field = argv[++i];
      const proposed = argv[++i];
      if (!cardId || !field || proposed === undefined) {
        throw new Error("--decline requires a card id, a field, and the proposed value");
      }
      declines.push({ cardId, path: field, proposed });
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { fetchOnly, cardIds: cardIds.length > 0 ? cardIds : undefined, declines };
}

async function recordDeclines(
  declines: Array<{ cardId: string; path: string; proposed: string }>
): Promise<void> {
  let next = [...REFRESH_DISMISSALS];
  let added = 0;
  for (const decline of declines) {
    const card = CARD_CATALOG.find((item) => item.id === decline.cardId);
    if (!card) throw new Error(`Unknown catalog card: ${decline.cardId}`);
    const recorded = addDismissal(next, card, decline.path, parseProposedValue(decline.proposed));
    next = recorded.dismissals;
    if (recorded.added) {
      added += 1;
      console.log(
        `Recorded a decline for ${card.name}: ${decline.path} stays at the catalog value instead of ${decline.proposed}.`
      );
    } else {
      console.log(`Already declined ${card.name}: ${decline.path} proposed ${decline.proposed}.`);
    }
  }
  if (added === 0) return;
  const file = path.join("src", "catalog", "refresh-dismissals.ts");
  await writeFile(file, renderDismissalsFile(next));
  console.log(`Commit ${file} so the next catalog refresh skips these.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
