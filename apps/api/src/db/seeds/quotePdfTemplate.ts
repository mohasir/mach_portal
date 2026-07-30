import { and, eq } from 'drizzle-orm';
import { TEMPLATE_TYPES, type QuotePdfTemplateContent } from '@repo/schemas';
import { db } from '../index';
import { templates } from '../schema';

const LOCALE = 'es';

const CONTENT: QuotePdfTemplateContent = {
  services: [
    {
      label: 'Snack Stations',
      duration:
        'Up to 2 hours or until all contracted servings have been distributed, whichever occurs first.',
    },
    {
      label: 'Mach Craft Bar',
      duration: '4-hour premium beverage service for the contracted number of guests.',
    },
  ],
  termsAndConditions: [
    'The price quoted is for Zelle and cash payments. For credit card and check payments, an additional 9% will be added.',
    'A deposit of 50% (NON-REFUNDABLE) per service is required to secure the booking.',
    'In the event of a natural disaster, government-mandated restriction, or other force majeure circumstance preventing the event, the client may reschedule at no additional cost, subject to availability, or receive a full refund minus the non-refundable deposit.',
    'The remaining balance must be paid on the day of the event prior to the start of the service, without exception.',
    'The last payment are accepted in cash. Otherwise, an additional 10% fee will be applied to the remaining balance.',
    'Only the portions contracted will be served. The service is NOT an open bar or refill service.',
    'If the contracted portions are not fully consumed by the end of the service, they will be left prepared. If the portions are fully consumed before the scheduled end time, the service will conclude.',
    'Please assign a clean and dry space, with outlet.',
    'If staff members are assaulted or mistreated by the client or guests, the service will be immediately canceled with no refund.',
    'Please notify us if the service will be located on more than 3 floors WITHOUT an elevator.',
    'For Mach Craft Bar, alcohol must be provided by the client. A professional bartender will contact you prior to the event with recommended alcohol selections, brands and quantities if cocktails are requested.',
  ],
  validityNote: 'Prices are valid for 3 months from the date of issue',
  dietaryNote:
    'If you have any dietary restrictions, allergies, religious requirements, or ingredient preferences, please let us know in advance so we can accommodate your needs whenever possible.',
};

export async function seedQuotePdfTemplate() {
  console.log('📄 Seeding plantilla de PDF...');

  const [existing] = await db
    .select({ id: templates.id })
    .from(templates)
    .where(and(eq(templates.type, TEMPLATE_TYPES.QUOTE_PDF), eq(templates.locale, LOCALE)))
    .limit(1);
  if (existing) {
    console.log('  ⏭️  quote_pdf template ya existe, salteando');
    return;
  }

  await db.insert(templates).values({
    type: TEMPLATE_TYPES.QUOTE_PDF,
    locale: LOCALE,
    content: CONTENT,
  });
  console.log('  ✅ quote_pdf template (servicios, términos, nota de validez, nota dietética)');
}
