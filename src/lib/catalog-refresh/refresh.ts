import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CARD_CATALOG } from "@/catalog";
import { CARD_SOURCE_URLS } from "@/catalog/sources";
import { htmlToText } from "@/lib/catalog-refresh/page-text";
import {
  guardProposal,
  type AcceptedBenefit,
  type AcceptedChange,
  type ModelProposal,
  type RejectedProposal,
} from "@/lib/catalog-refresh/proposal";
import type { CatalogCardDefinition } from "@/types";

const PAGE_CHAR_LIMIT = 16_000;
const MIN_PAGE_CHARS = 800;
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const SYSTEM_PROMPT = `You compare one credit card's catalog facts to text from the issuer's product page.
Return a JSON object:
{
  "changes": [{ "path": string, "proposed": number | string | boolean, "evidence": string }],
  "newBenefits": [{ "label": string, "description": string, "maxAnnualValue": number, "evidence": string }],
  "notes": string[]
}

Rules:
- Propose a change only when the page clearly disagrees with the catalog.
- evidence is one sentence copied from the page, 12 to 400 characters.
- Allowed paths: name, annualFee, baseMultiplier, multipliers.<category>, travelMultipliers.<flights|hotels|rentalCars>.<portal|direct>, hasLoungeAccess, transferPartners, directEarnPrograms, benefits.<existing id>.maxAnnualValue.
- Categories for non-travel multipliers: dining, grocery, gas, onlineShopping.
- Earn rates are numbers. "3x" and "3%" are both 3. "1.5%" is 1.5.
- Travel rates always use this shape, with both sides filled for every vertical:
  travelMultipliers: { flights: { portal, direct }, hotels: { portal, direct }, rentalCars: { portal, direct } }
- portal is the rate booked through the issuer portal (Chase Travel, Capital One Travel, Citi Travel). direct is booked with the airline, hotel, or car company. "Book directly", "booked directly", and "travel worldwide" are direct. Never write a book-directly rate to portal.
- When one portal rate covers flights, hotels, and rental cars, set that portal number on all three. Do the same for one direct rate. Do not use a default field.
- A sentence about hotels and rental cars must not set flights. "Select travel" does not add flights when that same quote names hotels and car rentals and never mentions flights.
- Do not write travel rates to multipliers.travel, multipliers.flights, multipliers.hotels, or multipliers.rentalCars.
- Example: 5x on Chase Travel and 2x on travel worldwide is flights, hotels, and rentalCars each { portal: 5, direct: 2 }. Do not propose it again when the catalog already has those numbers.
- annualFee is the ongoing annual fee in dollars, after any first-year waiver.
- hasLoungeAccess may be true only when this card includes lounge access or lounge passes. Do not set it false.
- transferPartners and directEarnPrograms: one change per program to add. proposed is one of american, delta, united, southwest, jetblue, alaska, marriott, hilton, hyatt. american means American Airlines or AAdvantage, not American Express. Do not propose removals.
- benefits.<id>.maxAnnualValue is the yearly dollar ceiling. A credit of $120 every four years is 30. Do not convert points or miles into dollars.
- Do not change id, ecosystem, rewardType, isPremium, valuedBy, stackRule, stackGroup, choice fields, labels, or descriptions.
- A new benefit is a statement credit with a dollar cap that is not already listed. Lounge access, insurance, status, and welcome bonuses are not new benefits.
- notes is empty when the page agrees with the catalog.
- Ignore welcome bonuses, APR, and intro APR.`;

export interface CardRefreshResult {
  cardId: string;
  cardName: string;
  sourceUrl: string;
  status: "no_change" | "proposed_change" | "fetch_failed" | "model_failed" | "fetched";
  message?: string;
  textLength?: number;
  changes: AcceptedChange[];
  newBenefits: AcceptedBenefit[];
  rejected: RejectedProposal[];
  notes: string[];
}

export interface RefreshReport {
  ranAt: string;
  directory: string;
  fetchOnly: boolean;
  hasProposals: boolean;
  results: CardRefreshResult[];
  summary: string;
}

export async function refreshCatalog(options: {
  cardIds?: string[];
  fetchOnly?: boolean;
  outDir?: string;
  model?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  complete?: (prompt: string) => Promise<ModelProposal>;
} = {}): Promise<RefreshReport> {
  const fetchOnly = options.fetchOnly ?? false;
  const fetchImpl = options.fetchImpl ?? fetch;
  const model = options.model?.trim() || "gpt-4.1-mini";
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? "";
  const cards = selectCards(options.cardIds);
  const ranAt = new Date().toISOString();
  const stamp = ranAt.replace(/[:.]/g, "-").slice(0, 19) + "Z";
  const directory = options.outDir ?? path.join("catalog-reviews", stamp);
  const complete =
    options.complete ??
    (fetchOnly ? null : (prompt: string) => completeWithOpenAI(prompt, apiKey, model));

  const results: CardRefreshResult[] = [];
  for (const card of cards) {
    const sourceUrl = CARD_SOURCE_URLS[card.id];
    const page = await fetchIssuerPage(sourceUrl, fetchImpl);
    if ("error" in page) {
      results.push(emptyResult(card, sourceUrl, "fetch_failed", page.error));
      continue;
    }
    if (fetchOnly || !complete) {
      results.push({
        ...emptyResult(card, sourceUrl, "fetched"),
        textLength: page.text.length,
        message: `Read ${page.text.length} characters from the issuer page.`,
      });
      continue;
    }
    try {
      const proposal = asModelProposal(
        await complete(userPrompt(card, page.text.slice(0, PAGE_CHAR_LIMIT)))
      );
      const guarded = guardProposal(card, page.text, proposal);
      const status = guarded.changes.length || guarded.newBenefits.length
        ? "proposed_change"
        : "no_change";
      results.push({
        ...emptyResult(card, sourceUrl, status),
        textLength: page.text.length,
        changes: guarded.changes,
        newBenefits: guarded.newBenefits,
        rejected: guarded.rejected,
        notes: guarded.notes,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Model request failed";
      results.push({
        ...emptyResult(card, sourceUrl, "model_failed", message),
        textLength: page.text.length,
      });
    }
  }

  const summary = renderRefreshSummary(results, { ranAt, fetchOnly });
  const report: RefreshReport = {
    ranAt,
    directory,
    fetchOnly,
    hasProposals: results.some((result) => result.status === "proposed_change"),
    results,
    summary,
  };
  await writeReport(report);
  return report;
}

export function renderRefreshSummary(
  results: CardRefreshResult[],
  meta: { ranAt: string; fetchOnly: boolean }
): string {
  const proposed = results.filter((result) => result.status === "proposed_change").length;
  const failed = results.filter(
    (result) => result.status === "fetch_failed" || result.status === "model_failed"
  ).length;
  const lines = [
    `# Catalog refresh`,
    ``,
    `Ran ${meta.ranAt}. Reviewed ${results.length} cards. ${proposed} with proposed changes. ${failed} could not be read.`,
    meta.fetchOnly ? `Fetch only: the model was not called.` : "",
    ``,
  ].filter((line, index, all) => line !== "" || all[index - 1] !== "");

  for (const result of results) {
    lines.push(`## ${result.cardName}`, ``, `Source: ${result.sourceUrl}`, ``);
    if (result.message && result.status !== "proposed_change" && result.status !== "no_change") {
      lines.push(result.message, ``);
      continue;
    }
    if (result.status === "no_change") lines.push("No material change.");
    for (const change of result.changes) {
      const next = change.path === "transferPartners" || change.path === "directEarnPrograms"
        ? `add ${String(change.proposed)}`
        : formatValue(change.proposed);
      lines.push(
        `- \`${change.path}\`: ${formatValue(change.current)} → ${next}`,
        `  Evidence: "${change.evidence}"`
      );
    }
    for (const benefit of result.newBenefits) {
      lines.push(
        `- New credit: ${benefit.label} ($${benefit.maxAnnualValue}/year). Leave valuedBy as manual until you map it to a Benefits answer.`,
        `  ${benefit.description}`,
        `  Evidence: "${benefit.evidence}"`
      );
    }
    if (result.rejected.length > 0) {
      lines.push("", "Left unchanged:");
      for (const item of result.rejected) {
        lines.push(`- ${item.path}: ${item.reason}`);
      }
    }
    for (const note of result.notes) lines.push(`- Note: ${note}`);
    lines.push("");
  }

  lines.push("These are drafts. The catalog files stay as they are until you edit them.");
  return lines.join("\n");
}

function selectCards(cardIds: string[] | undefined): CatalogCardDefinition[] {
  if (!cardIds || cardIds.length === 0) return CARD_CATALOG;
  const wanted = new Set(cardIds);
  const cards = CARD_CATALOG.filter((card) => wanted.has(card.id));
  const found = new Set(cards.map((card) => card.id));
  const missing = cardIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new Error(`Unknown catalog card: ${missing.join(", ")}`);
  }
  return cards;
}

function userPrompt(card: CatalogCardDefinition, pageText: string): string {
  return [
    `Card id: ${card.id}`,
    ``,
    `Current catalog facts:`,
    JSON.stringify(factsForPrompt(card), null, 2),
    ``,
    `Issuer page text:`,
    pageText,
  ].join("\n");
}

function factsForPrompt(card: CatalogCardDefinition) {
  return {
    id: card.id,
    name: card.name,
    annualFee: card.annualFee,
    baseMultiplier: card.baseMultiplier,
    multipliers: card.multipliers,
    travelMultipliers: card.travelMultipliers ?? null,
    transferPartners: card.transferPartners ?? [],
    directEarnPrograms: card.directEarnPrograms ?? [],
    hasLoungeAccess: card.hasLoungeAccess,
    rewardType: card.rewardType,
    benefits: (card.benefits ?? []).map((benefit) => ({
      id: benefit.id,
      label: benefit.label,
      description: benefit.description,
      maxAnnualValue: benefit.maxAnnualValue,
    })),
  };
}

async function fetchIssuerPage(
  url: string,
  fetchImpl: typeof fetch
): Promise<{ text: string } | { error: string }> {
  try {
    const response = await fetchImpl(url, {
      headers: { "User-Agent": BROWSER_USER_AGENT, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    const text = htmlToText(await response.text());
    if (!response.ok || text.length < MIN_PAGE_CHARS) {
      return {
        error: `Issuer page did not include benefit text (${response.status}, ${text.length} characters).`,
      };
    }
    return { text };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Fetch failed" };
  }
}

async function completeWithOpenAI(
  prompt: string,
  apiKey: string,
  model: string
): Promise<ModelProposal> {
  if (!apiKey) {
    throw new Error("Set OPENAI_API_KEY to draft catalog changes.");
  }
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Model request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("Model returned an empty response.");
  return JSON.parse(content) as ModelProposal;
}

function asModelProposal(value: ModelProposal): ModelProposal {
  return {
    changes: Array.isArray(value.changes) ? value.changes : [],
    newBenefits: Array.isArray(value.newBenefits) ? value.newBenefits : [],
    notes: value.notes,
  };
}

function emptyResult(
  card: CatalogCardDefinition,
  sourceUrl: string,
  status: CardRefreshResult["status"],
  message?: string
): CardRefreshResult {
  return {
    cardId: card.id,
    cardName: card.name,
    sourceUrl,
    status,
    message,
    changes: [],
    newBenefits: [],
    rejected: [],
    notes: [],
  };
}

async function writeReport(report: RefreshReport): Promise<void> {
  await mkdir(report.directory, { recursive: true });
  await writeFile(path.join(report.directory, "summary.md"), report.summary);
  for (const result of report.results) {
    await writeFile(
      path.join(report.directory, `${result.cardId}.json`),
      JSON.stringify(result, null, 2)
    );
  }
  await mkdir(path.dirname(path.join("catalog-reviews", "latest.json")), { recursive: true });
  await writeFile(
    path.join("catalog-reviews", "latest.json"),
    JSON.stringify(
      {
        ranAt: report.ranAt,
        directory: report.directory,
        fetchOnly: report.fetchOnly,
        hasProposals: report.hasProposals,
        fetchFailures: report.results.filter((result) => result.status === "fetch_failed").length,
        modelFailures: report.results.filter((result) => result.status === "model_failed").length,
      },
      null,
      2
    )
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "unset";
  if (Array.isArray(value)) return value.length === 0 ? "none" : value.join(", ");
  return String(value);
}
