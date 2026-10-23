/** Visible text from an issuer HTML page, for quote checks and the model prompt. */
export function htmlToText(html: string): string {
  const withoutEmbedded = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(withoutEmbedded).replace(/\s+/g, " ").trim();
}

export function normalizeText(value: string): string {
  return decodeEntities(value)
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[®™℠*†‡]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** True when `quote` is a short sentence that actually appears on the page. */
export function quoteAppearsOnPage(pageText: string, quote: string): boolean {
  const normalizedQuote = normalizeText(quote);
  if (normalizedQuote.length < 12 || normalizedQuote.length > 400) return false;
  return normalizeText(pageText).includes(normalizedQuote);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, digits: string) =>
      String.fromCodePoint(Number(digits))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    );
}
