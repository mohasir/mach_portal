import type { QuoteLineSelectionInput } from '@repo/schemas';
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
