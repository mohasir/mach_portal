import type { QuoteLineInput, QuoteLineSelectionInput } from '@repo/schemas';
import type { QuotesRepository } from './quotes.repository';

export type CatalogContext = Awaited<ReturnType<QuotesRepository['loadCatalogContext']>>;

// Shared by quotes.service.ts (full line validation on create/update) and
// events.service.ts (selections-only edits after approval, mach-bar-domain.md D17) — both
// entry points into quote_line_options must enforce the same maxSelect/active-option rules.
export function validateLineSelections(
  productId: string,
  selections: QuoteLineSelectionInput[],
  ctx: CatalogContext,
): boolean {
  for (const selection of selections) {
    const group = ctx.groups.find(
      (g) => g.id === selection.optionGroupId && g.productId === productId,
    );
    if (!group?.isActive) return false;

    if (group.selectionType === 'included') {
      if (selection.optionIds.length > 0) return false;
      continue;
    }
    if (group.maxSelect != null && selection.optionIds.length > group.maxSelect) return false;

    for (const optionId of selection.optionIds) {
      const option = ctx.options.find((o) => o.id === optionId && o.optionGroupId === group.id);
      if (!option?.isActive) return false;
    }
  }
  return true;
}

type LineShape = { productId: string; quantity: number; subtotal: number; uomId?: string };

// Order-insensitive identity of a line: its values, its unit and the set of chosen options.
// Groups with no chosen option are dropped because a stored line cannot represent them.
function lineKey(
  line: LineShape,
  selections: ReadonlyArray<{ optionGroupId: string; optionIds: readonly string[] }>,
): string {
  const picked = selections
    .flatMap((s) => s.optionIds.map((optionId) => `${s.optionGroupId}:${optionId}`))
    .sort();
  return JSON.stringify([line.productId, line.uomId, line.quantity, line.subtotal, picked]);
}

// For each submitted line, the stored line it resends unchanged, if any. Matching is a multiset:
// each stored line backs at most one submitted line. A submitted line without a unit is read in
// the product's current one, so a line that would silently switch unit does not match.
export function matchStoredLines<
  S extends LineShape & { selections: QuoteLineInput['selections'] },
>(
  submitted: readonly QuoteLineInput[],
  stored: readonly S[],
  currentUnits: ReadonlyMap<string, string>,
): (S | undefined)[] {
  const available = new Map<string, S[]>();
  for (const line of stored) {
    const key = lineKey(line, line.selections);
    available.set(key, [...(available.get(key) ?? []), line]);
  }
  return submitted.map((line) => {
    const key = lineKey(
      { ...line, uomId: line.uomId ?? currentUnits.get(line.productId) },
      line.selections,
    );
    return available.get(key)?.shift();
  });
}
