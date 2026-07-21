import type { QuotePdfTemplateContent } from '@repo/schemas';
import type {
  QuotePdfDetailBlock,
  QuotePdfFee,
  QuotePdfItem,
  QuotePdfRequest,
} from '../../lib/pdfService/types';
import type { ProductWithGroups } from '../products/products.resource';
import type { QuoteDetailRow, QuoteLineDetail } from './quotes.resource';

function buildItemDetails(
  line: QuoteLineDetail,
  product: ProductWithGroups,
): QuotePdfDetailBlock[] {
  return product.optionGroups
    .map((group) => {
      const isIncluded = group.selectionType === 'included';
      const selection = line.selections.find((s) => s.optionGroupId === group.id);
      const options = isIncluded
        ? group.options
        : group.options.filter((o) => selection?.optionIds.includes(o.id));
      return { title: group.label, options: options.map((o) => o.name) };
    })
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
        details: buildItemDetails(line, product),
      },
    ];
  });
}

function buildFees(quoteRow: QuoteDetailRow): QuotePdfFee[] | undefined {
  if (quoteRow.taxAmount <= 0) return undefined;
  const rate = Math.round(quoteRow.taxRate * 10000) / 100;
  return [
    {
      description: `Long Distance Travel Fee (${rate}%)`,
      amount: quoteRow.taxAmount / 100,
    },
  ];
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
