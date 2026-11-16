import { and, eq } from 'drizzle-orm';
import { TEMPLATE_TYPES, type QuotePdfTemplateContent } from '@repo/schemas';
import { db } from '../index';
import { templates } from '../schema';
import type { Executor } from '../index';

const LOCALE = 'es';

const CONTENT: QuotePdfTemplateContent = {
  services: [
    {
      label: 'Standard services',
      duration:
        'Until all contracted units have been delivered or the scheduled end time is reached, whichever occurs first.',
    },
    {
      label: 'Premium services',
      duration: 'Dedicated team for the contracted period and number of guests.',
    },
  ],
  termsAndConditions: [
    'The price quoted is for Zelle and cash payments. For credit card and check payments, an additional 9% will be added.',
    'A deposit of 50% (NON-REFUNDABLE) per service is required to secure the booking.',
    'In the event of a natural disaster, government-mandated restriction, or other force majeure circumstance preventing the event, the client may reschedule at no additional cost, subject to availability, or receive a full refund minus the non-refundable deposit.',
    'The remaining balance must be paid on the day of the event prior to the start of the service, without exception.',
    'The last payment are accepted in cash. Otherwise, an additional 10% fee will be applied to the remaining balance.',
    'Only the quantities contracted will be provided.',
    'Please assign a clean and dry space, with outlet.',
    'If staff members are assaulted or mistreated by the client or guests, the service will be immediately canceled with no refund.',
    'Please notify us if the service will be located on more than 3 floors WITHOUT an elevator.',
  ],
  validityNote: 'Prices are valid for 3 months from the date of issue',
  dietaryNote:
    'If you have any special requirements or preferences, please let us know in advance so we can accommodate your needs whenever possible.',
};

export async function seedQuotePdfTemplate(tenantId: string, x: Executor = db) {
  console.log('📄 Seeding plantilla de PDF...');

  const [existing] = await x
    .select({ id: templates.id })
    .from(templates)
    .where(
      and(
        eq(templates.tenantId, tenantId),
        eq(templates.type, TEMPLATE_TYPES.QUOTE_PDF),
        eq(templates.locale, LOCALE),
      ),
    )
    .limit(1);
  if (existing) {
    console.log('  ⏭️  quote_pdf template ya existe, salteando');
    return;
  }

  await x.insert(templates).values({
    type: TEMPLATE_TYPES.QUOTE_PDF,
    locale: LOCALE,
    content: CONTENT,
    tenantId,
  });
  console.log('  ✅ quote_pdf template (servicios, términos, nota de validez, nota dietética)');
}
