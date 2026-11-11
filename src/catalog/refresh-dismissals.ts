import type { RefreshDismissal } from "@/lib/catalog-refresh/dismissals";

/**
 * Proposed catalog edits you reviewed and chose not to apply.
 * The next refresh skips a change when the card, field, and proposed value match.
 * Delete an entry to let a future refresh propose that value again.
 *
 *   npm run catalog:refresh -- --decline <cardId> <path> <proposed>
 */
export const REFRESH_DISMISSALS: RefreshDismissal[] = [];
