import { computeQuoteTotals, type QuoteTotals } from '@repo/schemas';
import { effectiveCharges, type BuilderCharge } from './chargeHelpers';
import { lineTaxRates } from './lineHelpers';
import type { QuoteBuilderState } from './quotes.store';

interface TaxableProduct {
  id: string;
  uomId: string;
  taxRate: number;
  taxExempt: boolean;
}

export interface TaxSummaryRow {
  /** Null for tax that no line carries (see summarizeLineTaxes); shown without a rate. */
  taxRate: number | null;
  taxAmount: number;
}

export interface BuilderTotals {
  totals: QuoteTotals;
  taxRows: TaxSummaryRow[];
  chargeRows: (BuilderCharge & { amount: number })[];
}

/** Rates that add no tax are not worth a row. */
export const taxSummaryRows = (breakdown: readonly TaxSummaryRow[]): TaxSummaryRow[] =>
  breakdown
    .filter((row) => row.taxAmount !== 0)
    .map(({ taxRate, taxAmount }) => ({ taxRate, taxAmount }));

/** The preview total: the same `computeQuoteTotals` the API saves and the PDF prints. */
export function computeBuilderTotals(
  state: QuoteBuilderState,
  savedState: QuoteBuilderState,
  catalog: readonly TaxableProduct[],
  chargesEnabled: boolean,
): BuilderTotals {
  const rates = lineTaxRates(state.lines, savedState.lines, catalog);
  const charges = effectiveCharges(state.charges, chargesEnabled);
  const totals = computeQuoteTotals({
    lines: state.lines.map((line, index) => ({ subtotal: line.subtotal, taxRate: rates[index]! })),
    discountType: state.discountType,
    discountValue: state.discountValue,
    charges: charges.map(({ kind, value }) => ({ kind, value })),
    depositRate: state.depositRate,
  });
  return {
    totals,
    taxRows: taxSummaryRows(totals.taxBreakdown),
    chargeRows: charges.map((charge, index) => ({
      ...charge,
      amount: totals.charges[index]!.amount,
    })),
  };
}
