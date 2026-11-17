import { summarizeLineTaxes, type QuotePdfTemplateContent } from '@repo/schemas';
import type {
  QuotePdfDetailBlock,
  QuotePdfFee,
  QuotePdfItem,
  QuotePdfRequest,
} from '../../lib/pdfService/types';
import type { ProductWithGroups } from '../products/products.resource';
import type { QuoteChargeDetail, QuoteDetailRow, QuoteLineDetail } from './quotes.resource';

function formatGroupTitle(group: ProductWithGroups['optionGroups'][number]): string {
  if (group.selectionType === 'included') return `${group.label} (Included)`;
  return group.maxSelect != null ? `${group.label} (Choose any ${group.maxSelect})` : group.label;
}

// The quote PDF is a sales document, not a record of what was actually picked — a
// line's options may still be unresolved at quote time (chosen later, at the event) or
// already resolved, but either way the client sees the product's full menu, not just
// whatever happens to be selected internally.
function buildItemDetails(product: ProductWithGroups): QuotePdfDetailBlock[] {
  return product.optionGroups
    .filter((group) => group.isActive)
    .flatMap((group) => {
      const block = {
        title: formatGroupTitle(group),
        options: group.options.filter((o) => o.isActive).map((o) => o.name),
      };
      return block.options.length > 0 ? [block] : [];
    });
}

function buildItems(lines: QuoteLineDetail[], catalog: ProductWithGroups[]): QuotePdfItem[] {
  return lines.flatMap((line) => {
    const product = catalog.find((p) => p.id === line.productId);
    if (!product) return [];
    return [
      {
        sku: product.id,
        description: product.name,
        quantity: line.quantity,
        total: line.subtotal / 100,
        details: buildItemDetails(product),
      },
    ];
  });
}

const percentLabel = (rate: number) => `${Math.round(rate * 10000) / 100}%`;

function buildFees(
  quoteRow: QuoteDetailRow,
  lines: QuoteLineDetail[],
  charges: QuoteChargeDetail[],
): QuotePdfFee[] | undefined {
  const fees: QuotePdfFee[] = [];

  for (const { taxRate, taxAmount } of summarizeLineTaxes(lines, quoteRow.taxAmount)) {
    if (taxRate === null) {
      if (taxAmount !== 0) fees.push({ description: 'Tax', amount: taxAmount / 100 });
      continue;
    }
    if (taxAmount <= 0) continue;
    fees.push({ description: `Tax (${percentLabel(taxRate)})`, amount: taxAmount / 100 });
  }

  for (const charge of charges) {
    if (charge.amount <= 0) continue;
    const description =
      charge.kind === 'percent' ? `${charge.name} (${percentLabel(charge.value)})` : charge.name;
    fees.push({ description, amount: charge.amount / 100 });
  }

  return fees.length > 0 ? fees : undefined;
}

export function buildQuotePdfPayload(
  quoteRow: QuoteDetailRow,
  lines: QuoteLineDetail[],
  charges: QuoteChargeDetail[],
  catalog: ProductWithGroups[],
  template: QuotePdfTemplateContent | undefined,
): QuotePdfRequest {
  // Same combining rule as AddressLines.tsx (street, then "city, state"), minus the
  // state's translated display name — a US-facing PDF reads fine with the raw code.
  const location =
    [quoteRow.address, quoteRow.city, quoteRow.state].filter(Boolean).join(', ') || undefined;
  const hasEventInfo = Boolean(
    quoteRow.eventDate ?? quoteRow.eventTypeName ?? quoteRow.eventTime ?? location,
  );

  return {
    template: 'mach_quote',
    document_number: quoteRow.number,
    client_name: quoteRow.clientName,
    event: hasEventInfo
      ? {
          date: quoteRow.eventDate ?? undefined,
          type: quoteRow.eventTypeName ?? undefined,
          time: quoteRow.eventTime ?? undefined,
          location,
        }
      : undefined,
    services: template?.services.length ? template.services : undefined,
    items: buildItems(lines, catalog),
    fees: buildFees(quoteRow, lines, charges),
    deposit: quoteRow.depositAmount / 100,
    terms_and_conditions: template?.termsAndConditions.length
      ? template.termsAndConditions
      : undefined,
    validity_note: template?.validityNote,
    dietary_note: template?.dietaryNote,
    additional_notes: quoteRow.clientNotes ?? undefined,
  };
}
