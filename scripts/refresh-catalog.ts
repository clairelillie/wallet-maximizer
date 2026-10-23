import { refreshCatalog } from "../src/lib/catalog-refresh/refresh";

/**
 * Draft a catalog review from each card's issuer page.
 *
 *   npm run catalog:refresh
 *   npm run catalog:refresh -- --card amex-gold
 *   npm run catalog:refresh -- --fetch-only
 *
 * Set OPENAI_API_KEY. Optional CATALOG_REFRESH_MODEL (default gpt-4.1-mini).
 * Writes catalog-reviews/ and does not edit src/catalog.
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));
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
  let fetchOnly = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--fetch-only") {
      fetchOnly = true;
    } else if (arg === "--card") {
      const id = argv[++i];
      if (!id) throw new Error("--card requires a catalog id");
      cardIds.push(id);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { fetchOnly, cardIds: cardIds.length > 0 ? cardIds : undefined };
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
