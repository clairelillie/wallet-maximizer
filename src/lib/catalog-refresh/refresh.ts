import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CARD_CATALOG } from "@/catalog";
import { REFRESH_DISMISSALS } from "@/catalog/refresh-dismissals";
import { CARD_SOURCE_URLS } from "@/catalog/sources";
import {
  declineCommand,
  newBenefitPath,
  splitDismissals,
  type DismissedProposal,
  type RefreshDismissal,
} from "@/lib/catalog-refresh/dismissals";
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
- evidence is copied from the page, 12 to 400 characters. When a heading above the rate says where to book, include that heading with the rate sentence.
- Allowed paths: name, annualFee, baseMultiplier, multipliers.<category>, travelMultipliers.<flights|hotels|rentalCars>.<portal|direct>, hasLoungeAccess, transferPartners, directEarnPrograms, benefits.<existing id>.maxAnnualValue.
- Categories for non-travel multipliers: dining, grocery, gas, onlineShopping.
- Earn rates are numbers. "3x" and "3%" are both 3. "1.5%" is 1.5.
- Travel rates use travelMultipliers.<flights|hotels|rentalCars>.<portal|direct>. Propose only the side the page is describing, and propose each path once.
- portal is booked through the issuer portal. Capital One Travel, Chase Travel, Citi Travel, and Amex Travel are portal, including when that name is only in the heading above the rate (for example "Book with Capital One Travel"). direct is booked with the airline, hotel, or car company. "Book directly", "booked directly", and "travel worldwide" are direct.
- Never write a portal rate onto direct, or a book-directly rate onto portal. Use the same number for both sides only when the page states one rate and does not say where it is booked.
- When one portal rate covers flights, hotels, and rental cars, set that portal number on all three portal paths. Do the same for one direct rate. Do not use a default field.
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
  /** Proposals skipped because you already declined this card, field, and value. */
  dismissed: DismissedProposal[];
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
  dismissals?: RefreshDismissal[];
} = {}): Promise<RefreshReport> {
  const fetchOnly = options.fetchOnly ?? false;
  const fetchImpl = options.fetchImpl ?? fetch;
  const model = options.model?.trim() || "gpt-4.1-mini";
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? "";
  const cards = selectCards(options.cardIds);
  const ranAt = new Date().toISOString();
  const stamp = ranAt.replace(/[:.]/g, "-").slice(0, 19) + "Z";
  const directory = options.outDir ?? path.join("catalog-reviews", stamp);
  const dismissals = options.dismissals ?? REFRESH_DISMISSALS;
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
      const reviewed = splitDismissals(card.id, guarded, dismissals);
      const status = reviewed.changes.length || reviewed.newBenefits.length
        ? "proposed_change"
        : "no_change";
      results.push({
        ...emptyResult(card, sourceUrl, status),
        textLength: page.text.length,
        changes: reviewed.changes,
        newBenefits: reviewed.newBenefits,
        dismissed: reviewed.dismissed,
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
  const proposed = results.filter((result) => result.status === "proposed_change");
  const unchanged = results.filter((result) => result.status === "no_change");
  const failed = results.filter(
    (result) => result.status === "fetch_failed" || result.status === "model_failed"
  );
  const fetched = results.filter((result) => result.status === "fetched");
  const declined = results.reduce((sum, result) => sum + result.dismissed.length, 0);
  const counts = `Ran ${meta.ranAt}. Reviewed ${results.length} cards. ${proposed.length} with proposed changes. ${failed.length} could not be read.`;
  const lines = [
    "# Catalog refresh",
    "",
    declined > 0 ? `${counts} ${declined} declined earlier.` : counts,
    "",
  ];
  if (meta.fetchOnly) lines.push("Fetch only: the model was not called.", "");

  if (proposed.length > 0) {
    lines.push(
      "## Proposed changes",
      "",
      "Copy a command under a change to keep the current catalog value. The next refresh will not propose that value again.",
      ""
    );
    proposed.forEach((result, index) => {
      if (index > 0) lines.push("---", "");
      lines.push(...renderProposedCard(result));
    });
  }

  lines.push(...renderUnchanged(unchanged));

  if (failed.length > 0) {
    lines.push("## Could not read", "");
    for (const result of failed) {
      lines.push(`- **${result.cardName}** — ${result.message ?? "The issuer page could not be read."}`);
    }
    lines.push("");
  }

  if (fetched.length > 0) {
    lines.push("## Pages read", "");
    for (const result of fetched) {
      lines.push(`- **${result.cardName}** — ${result.message ?? "Read the issuer page."}`);
    }
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
    dismissed: [],
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

const CATEGORY_LABELS: Record<string, string> = {
  dining: "Dining",
  grocery: "Grocery",
  gas: "Gas",
  onlineShopping: "Online shopping",
  flights: "Flights",
  hotels: "Hotels",
  rentalCars: "Rental cars",
  travel: "Travel",
};

const CHANNEL_ORDER = ["flights", "hotels", "rentalCars"];
const MULTIPLIER_ORDER = ["dining", "grocery", "gas", "onlineShopping"];

function scalarRank(path: string): number {
  if (path === "name") return 0;
  if (path === "annualFee") return 1;
  if (path === "hasLoungeAccess") return 2;
  if (path === "baseMultiplier") return 3;
  if (path.startsWith("multipliers.")) return 4;
  if (path === "transferPartners" || path === "directEarnPrograms") return 5;
  if (path.startsWith("benefits.")) return 6;
  return 7;
}

function multiplierRank(path: string): number {
  const index = MULTIPLIER_ORDER.indexOf(path.split(".")[1] ?? "");
  return index === -1 ? MULTIPLIER_ORDER.length : index;
}

const PROGRAM_LABELS: Record<string, string> = {
  american: "American Airlines",
  delta: "Delta",
  united: "United",
  southwest: "Southwest",
  jetblue: "JetBlue",
  alaska: "Alaska",
  marriott: "Marriott",
  hilton: "Hilton",
  hyatt: "Hyatt",
};

function renderProposedCard(result: CardRefreshResult): string[] {
  const lines = [`### ${result.cardName}`, "", `Source: ${result.sourceUrl}`, ""];
  const travel = result.changes.filter((change) => change.path.startsWith("travelMultipliers."));
  const rest = result.changes
    .filter((change) => !change.path.startsWith("travelMultipliers."))
    .sort(
      (a, b) =>
        scalarRank(a.path) - scalarRank(b.path) || multiplierRank(a.path) - multiplierRank(b.path)
    );

  for (const group of groupByEvidence(rest)) {
    lines.push(...renderScalarGroup(result.cardId, group.items));
  }
  if (travel.length > 0) {
    lines.push("#### Travel earn rates", "");
    for (const group of groupByEvidence(travel)) {
      lines.push(travelHeadline(group.items), "", travelTable(group.items), "");
      lines.push(...keepCurrentLines(result.cardId, sortTravelForDecline(group.items)));
      lines.push(...quoteBlock(group.evidence));
    }
  }
  for (const benefit of result.newBenefits) {
    lines.push(
      "#### New credit",
      "",
      `**${benefit.label}** — ${money(benefit.maxAnnualValue)} a year`,
      "",
      `${benefit.description} Leave this as a manual value until you map it to a Benefits answer.`,
      "",
      ...keepCurrentLines(result.cardId, [
        { path: newBenefitPath(benefit.label), proposed: benefit.maxAnnualValue },
      ]),
      ...quoteBlock(benefit.evidence)
    );
  }
  if (result.rejected.length > 0) {
    lines.push("#### Not applied", "");
    for (const item of result.rejected) {
      lines.push(`- ${labelForPath(result.cardId, item.path)}: ${item.reason}`);
    }
    lines.push("");
  }
  if (result.notes.length > 0) {
    lines.push("#### Notes", "");
    for (const note of result.notes) lines.push(`- ${note}`);
    lines.push("");
  }
  return lines;
}

function renderUnchanged(results: CardRefreshResult[]): string[] {
  const quiet = results.filter((result) => result.rejected.length === 0 && result.notes.length === 0);
  const explained = results.filter(
    (result) => result.rejected.length > 0 || result.notes.length > 0
  );
  if (quiet.length === 0 && explained.length === 0) return [];
  const lines = ["## No change", ""];
  if (quiet.length > 0) lines.push(quiet.map((result) => result.cardName).join(", "), "");
  if (explained.length > 0) {
    lines.push("Read, and left as they are:", "");
    for (const result of explained) {
      for (const item of result.rejected) {
        lines.push(`- **${result.cardName}** — ${labelForPath(result.cardId, item.path)}: ${item.reason}`);
      }
      for (const note of result.notes) lines.push(`- **${result.cardName}** — ${note}`);
    }
    lines.push("");
  }
  return lines;
}

function renderScalarGroup(cardId: string, items: AcceptedChange[]): string[] {
  const lines: string[] = [];
  for (const cluster of clusterScalars(items)) {
    const sample = cluster[0];
    if (sample.path === "transferPartners" || sample.path === "directEarnPrograms") {
      lines.push(programSentence(sample));
      continue;
    }
    const labels = joinNames(
      sortMultipliers(cluster).map((change) => labelForPath(cardId, change.path))
    );
    const verb = cluster.length > 1 ? "change" : "changes";
    lines.push(
      `${labels} ${verb} from ${formatCurrent(sample)} to ${formatProposed(sample)}.`
    );
  }
  lines.push("", ...keepCurrentLines(cardId, items), ...quoteBlock(items[0].evidence));
  return lines;
}

function keepCurrentLines(
  cardId: string,
  items: Array<{ path: string; proposed: number | string | boolean }>
): string[] {
  const lines = ["To keep the current catalog value:", ""];
  for (const item of items) {
    lines.push(
      `- ${labelForPath(cardId, item.path)}: \`${declineCommand(cardId, item.path, item.proposed)}\``
    );
  }
  lines.push("");
  return lines;
}

function sortTravelForDecline(changes: AcceptedChange[]): AcceptedChange[] {
  const sideRank = (path: string) => (path.endsWith(".direct") ? 1 : 0);
  return [...changes].sort((a, b) => {
    const channel =
      CHANNEL_ORDER.indexOf(a.path.split(".")[1] ?? "") -
      CHANNEL_ORDER.indexOf(b.path.split(".")[1] ?? "");
    return channel || sideRank(a.path) - sideRank(b.path);
  });
}

function travelHeadline(changes: AcceptedChange[]): string {
  const portal = sortTravel(changes.filter((change) => change.path.endsWith(".portal")));
  const direct = sortTravel(changes.filter((change) => change.path.endsWith(".direct")));
  if (portal.length > 0 && direct.length > 0 && sameTravelShape(portal, direct)) {
    return `${joinNames(channelNames(portal))} change from ${plainDelta(portal[0])} on both portal and direct bookings.`;
  }
  const sentences: string[] = [];
  if (portal.length > 0) sentences.push(sideSentences(portal, "through the portal"));
  if (direct.length > 0) sentences.push(sideSentences(direct, "directly"));
  if (portal.length === 0) sentences.push("Portal bookings stay at the catalog rate.");
  if (direct.length === 0) sentences.push("Direct bookings stay at the catalog rate.");
  return sentences.join(" ");
}

function sideSentences(changes: AcceptedChange[], where: string): string {
  const buckets = new Map<string, AcceptedChange[]>();
  for (const change of changes) {
    const key = deltaKey(change);
    const list = buckets.get(key) ?? [];
    list.push(change);
    buckets.set(key, list);
  }
  return [...buckets.entries()]
    .map(([key, group]) => {
      const [from, to] = key.split("|");
      return `${joinNames(channelNames(group))} booked ${where} change from ${from} to ${to}.`;
    })
    .join(" ");
}

function travelTable(changes: AcceptedChange[]): string {
  const rows = new Map<string, { portal?: AcceptedChange; direct?: AcceptedChange }>();
  for (const change of changes) {
    const [, channel, side] = change.path.split(".");
    if (!channel || (side !== "portal" && side !== "direct")) continue;
    const row = rows.get(channel) ?? {};
    row[side] = change;
    rows.set(channel, row);
  }
  const lines = ["| Category | Portal | Direct |", "| --- | --- | --- |"];
  for (const channel of CHANNEL_ORDER) {
    const row = rows.get(channel);
    if (!row) continue;
    lines.push(`| ${categoryLabel(channel)} | ${rateCell(row.portal)} | ${rateCell(row.direct)} |`);
  }
  return lines.join("\n");
}

function rateCell(change: AcceptedChange | undefined): string {
  if (!change) return "unchanged";
  return `${formatPlain(change.current)} → ${formatPlain(change.proposed)}`;
}

function groupByEvidence(changes: AcceptedChange[]): Array<{ evidence: string; items: AcceptedChange[] }> {
  const groups: Array<{ evidence: string; items: AcceptedChange[] }> = [];
  for (const change of changes) {
    const existing = groups.find((group) => group.evidence === change.evidence);
    if (existing) existing.items.push(change);
    else groups.push({ evidence: change.evidence, items: [change] });
  }
  return groups;
}

function clusterScalars(items: AcceptedChange[]): AcceptedChange[][] {
  const used = new Set<number>();
  const clusters: AcceptedChange[][] = [];
  items.forEach((item, index) => {
    if (used.has(index)) return;
    const cluster = [item];
    used.add(index);
    if (item.path.startsWith("multipliers.")) {
      items.forEach((other, otherIndex) => {
        if (used.has(otherIndex) || !other.path.startsWith("multipliers.")) return;
        if (deltaKey(other) !== deltaKey(item)) return;
        cluster.push(other);
        used.add(otherIndex);
      });
    }
    clusters.push(cluster);
  });
  return clusters;
}

function programSentence(change: AcceptedChange): string {
  const list = change.path === "transferPartners" ? "transfer partners" : "direct earn programs";
  const added = programLabel(change.proposed);
  const current = formatProgramList(change.current);
  if (current === "none") return `${added} is added to ${list}.`;
  return `${added} is added to ${list}. Already listed: ${current}.`;
}

function quoteBlock(evidence: string): string[] {
  return ["From the page:", "", `> ${evidence.replace(/\s+/g, " ").trim()}`, ""];
}

function labelForPath(cardId: string, path: string): string {
  if (path.startsWith("newBenefit:")) return path.slice("newBenefit:".length);
  if (path === "newBenefit") return "New credit";
  if (path === "annualFee") return "Annual fee";
  if (path === "baseMultiplier") return "Base earn rate";
  if (path === "name") return "Card name";
  if (path === "hasLoungeAccess") return "Lounge access";
  if (path === "transferPartners") return "Transfer partners";
  if (path === "directEarnPrograms") return "Direct earn programs";
  const parts = path.split(".");
  if (parts[0] === "multipliers" && parts[1]) return categoryLabel(parts[1]);
  if (parts[0] === "travelMultipliers" && parts[1]) {
    const side = parts[2] === "portal" || parts[2] === "direct" ? parts[2] : "";
    return side ? `${categoryLabel(parts[1])}, ${side}` : categoryLabel(parts[1]);
  }
  if (parts[0] === "benefits" && parts[1] && parts[2] === "maxAnnualValue") {
    return `${benefitName(cardId, parts[1])} yearly value`;
  }
  return path;
}

function benefitName(cardId: string, benefitId: string): string {
  const card = CARD_CATALOG.find((item) => item.id === cardId);
  const benefit = card?.benefits?.find((item) => item.id === benefitId);
  if (benefit) return benefit.label;
  return benefitId
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

function channelNames(changes: AcceptedChange[]): string[] {
  return sortTravel(changes).map((change) => categoryLabel(change.path.split(".")[1] ?? ""));
}

function sortTravel(changes: AcceptedChange[]): AcceptedChange[] {
  return [...changes].sort(
    (a, b) =>
      CHANNEL_ORDER.indexOf(a.path.split(".")[1] ?? "") -
      CHANNEL_ORDER.indexOf(b.path.split(".")[1] ?? "")
  );
}

function sortMultipliers(changes: AcceptedChange[]): AcceptedChange[] {
  return [...changes].sort(
    (a, b) =>
      MULTIPLIER_ORDER.indexOf(a.path.split(".")[1] ?? "") -
      MULTIPLIER_ORDER.indexOf(b.path.split(".")[1] ?? "")
  );
}

function sameTravelShape(portal: AcceptedChange[], direct: AcceptedChange[]): boolean {
  const key = (change: AcceptedChange) =>
    `${change.path.split(".")[1]}:${formatPlain(change.current)}:${formatPlain(change.proposed)}`;
  return portal.map(key).sort().join("|") === direct.map(key).sort().join("|");
}

function plainDelta(change: AcceptedChange): string {
  return `${formatPlain(change.current)} to ${formatPlain(change.proposed)}`;
}

function deltaKey(change: AcceptedChange): string {
  return `${formatCurrent(change)}|${formatProposed(change)}`;
}

function formatCurrent(change: AcceptedChange): string {
  if (change.path === "hasLoungeAccess") return formatYesNo(change.current);
  if (isMoneyPath(change.path)) return money(change.current);
  if (change.path === "transferPartners" || change.path === "directEarnPrograms") {
    return formatProgramList(change.current);
  }
  return formatPlain(change.current);
}

function formatProposed(change: AcceptedChange): string {
  if (change.path === "hasLoungeAccess") return formatYesNo(change.proposed);
  if (isMoneyPath(change.path)) return money(change.proposed);
  return formatPlain(change.proposed);
}

function isMoneyPath(path: string): boolean {
  return path === "annualFee" || path.endsWith(".maxAnnualValue");
}

function formatYesNo(value: unknown): string {
  return value === true || value === "true" ? "Yes" : "No";
}

function formatProgramList(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "none";
  return value.map((item) => programLabel(item)).join(", ");
}

function programLabel(value: unknown): string {
  const id = String(value);
  return PROGRAM_LABELS[id] ?? id;
}

function money(value: unknown): string {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return formatPlain(value);
  const text = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `$${text}`;
}

function formatPlain(value: unknown): string {
  if (value === null || value === undefined) return "unset";
  if (Array.isArray(value)) return value.length === 0 ? "none" : value.join(", ");
  return String(value);
}

function joinNames(names: string[]): string {
  const words = names.map((name, index) => (index === 0 ? name : name.toLowerCase()));
  if (words.length <= 1) return words[0] ?? "";
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(", ")}, and ${words[words.length - 1]}`;
}
