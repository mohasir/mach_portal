import type { QuotePdfTemplateContent } from '@repo/schemas';
import type {
  QuotePdfDetailBlock,
  QuotePdfFee,
  QuotePdfItem,
  QuotePdfRequest,
} from '../../lib/pdfService/types';
import type { ProductWithGroups } from '../products/products.resource';
import type { QuoteDetailRow, QuoteLineDetail } from './quotes.resource';

// The quote PDF is a sales document, not a record of what was actually picked — a
// line's options may still be unresolved at quote time (chosen later, at the event) or
// already resolved, but either way the client sees the station's full menu, not just
// whatever happens to be selected internally.
function buildItemDetails(product: ProductWithGroups): QuotePdfDetailBlock[] {
  return product.optionGroups
    .map((group) => ({ title: group.label, options: group.options.map((o) => o.name) }))
    .filter((block) => block.options.length > 0);
}

function buildItems(lines: QuoteLineDetail[], catalog: ProductWithGroups[]): QuotePdfItem[] {
  return lines.flatMap((line) => {
    const product = catalog.find((p) => p.id === line.productId);
    if (!product) return [];
    return [
      {
        sku: product.id,
        description: product.name,
        quantity: line.numPersons,
        total: line.subtotal / 100,
        details: buildItemDetails(product),
      },
    ];
  });
}

function buildFees(quoteRow: QuoteDetailRow): QuotePdfFee[] | undefined {
  const fees: QuotePdfFee[] = [];

  if (quoteRow.longDistanceAmount > 0) {
    fees.push({
      description: 'Long Distance Travel Fee',
      amount: quoteRow.longDistanceAmount / 100,
    });
  }

  if (quoteRow.taxAmount > 0) {
    const rate = Math.round(quoteRow.taxRate * 10000) / 100;
    fees.push({
      description: `Tax (${rate}%)`,
      amount: quoteRow.taxAmount / 100,
    });
  }

  if (quoteRow.cardSurchargeAmount > 0) {
    const rate = Math.round(quoteRow.cardSurchargeRate * 100);
    fees.push({
      description: `Card/Check Surcharge (${rate}%)`,
      amount: quoteRow.cardSurchargeAmount / 100,
    });
  }

  return fees.length > 0 ? fees : undefined;
}

export function buildQuotePdfPayload(
  quoteRow: QuoteDetailRow,
  lines: QuoteLineDetail[],
  catalog: ProductWithGroups[],
  template: QuotePdfTemplateContent | undefined,
): QuotePdfRequest {
  const hasEventInfo = Boolean(
    quoteRow.eventDate ?? quoteRow.eventTypeName ?? quoteRow.eventTime ?? quoteRow.address,
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
          location: quoteRow.address ?? undefined,
        }
      : undefined,
    services: template?.services.length ? template.services : undefined,
    items: buildItems(lines, catalog),
    fees: buildFees(quoteRow),
    deposit: quoteRow.depositAmount / 100,
    terms_and_conditions: template?.termsAndConditions.length
      ? template.termsAndConditions
      : undefined,
    validity_note: template?.validityNote,
    dietary_note: template?.dietaryNote,
  };
}
