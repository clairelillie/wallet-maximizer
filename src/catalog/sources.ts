/**
 * Official issuer product pages for the catalog refresh job.
 * `npm run catalog:refresh` reads these pages and drafts a review.
 * It does not edit the catalog.
 */
export const CARD_SOURCE_URLS: Record<string, string> = {
  "chase-sapphire-preferred":
    "https://www.chase.com/sapphire-cards/personal/preferred",
  "chase-sapphire-reserve":
    "https://www.chase.com/sapphire-cards/personal/reserve",
  "chase-freedom-unlimited":
    "https://www.chase.com/personal/credit-cards/freedom/unlimited",
  "chase-freedom-flex":
    "https://creditcards.chase.com/cash-back-credit-cards/freedom/flex",

  "amex-platinum": "https://www.americanexpress.com/us/credit-cards/card/platinum/",
  "amex-gold": "https://www.americanexpress.com/us/credit-cards/card/gold-card/",
  "amex-blue-cash-preferred":
    "https://www.americanexpress.com/us/credit-cards/card/blue-cash-preferred/",
  "amex-blue-cash-everyday":
    "https://www.americanexpress.com/us/credit-cards/card/blue-cash-everyday/",

  "capital-one-venture-x": "https://www.capitalone.com/credit-cards/venture-x/",
  "capital-one-venture": "https://www.capitalone.com/credit-cards/venture/",
  "capital-one-savor": "https://www.capitalone.com/credit-cards/savor/",
  "capital-one-quicksilver":
    "https://www.capitalone.com/credit-cards/quicksilver/",

  "citi-double-cash":
    "https://www.citi.com/credit-cards/citi-double-cash-credit-card",
  "citi-strata-premier":
    "https://www.citi.com/credit-cards/citi-strata-premier-credit-card",
  "citi-strata": "https://www.citi.com/credit-cards/citi-strata-credit-card",
  "citi-strata-elite":
    "https://www.citi.com/credit-cards/citi-strata-elite-credit-card",
};
