import { eq } from 'drizzle-orm';
import { QUOTE_STAGE, type QuoteStageColor } from '@repo/schemas';
import { db } from '../index';
import { quoteStages } from '../schema';

const SEED_QUOTE_STAGES: {
  id: number;
  label: string;
  color: QuoteStageColor;
  description: string;
  sortOrder: number;
}[] = [
  {
    id: QUOTE_STAGE.PENDING,
    label: 'Pendiente',
    color: '#8c8c8c',
    description:
      'La cotización se guardó como borrador y todavía no se envió al cliente. Se puede seguir editando libremente hasta que se envíe.',
    sortOrder: 0,
  },
  {
    id: QUOTE_STAGE.QUOTED,
    label: 'Enviada',
    color: '#faad14',
    description:
      'Ya se envió al cliente y está esperando que la acepte o rechace. Tiene una fecha de vencimiento configurada en Cotizaciones.',
    sortOrder: 1,
  },
  {
    id: QUOTE_STAGE.CONFIRMED,
    label: 'Aprobada',
    color: '#52c41a',
    description:
      'El cliente la aceptó y queda lista para convertirse en evento. Desde acá la cotización ya no se puede editar, solo cancelar.',
    sortOrder: 2,
  },
  {
    id: QUOTE_STAGE.CANCELLED,
    label: 'Cancelada',
    color: '#f5222d',
    description:
      'Se canceló, ya sea porque el cliente la rechazó o porque se decidió no seguir adelante. Se puede reabrir volviendo a Enviada.',
    sortOrder: 3,
  },
];

export async function seedQuoteStages() {
  console.log('🏷️  Seeding estados de cotización...');

  for (const s of SEED_QUOTE_STAGES) {
    const [existing] = await db
      .select({ id: quoteStages.id })
      .from(quoteStages)
      .where(eq(quoteStages.id, s.id))
      .limit(1);
    if (existing) {
      console.log(`  ⏭️  ${s.label} ya existe, salteando`);
      continue;
    }
    await db.insert(quoteStages).values(s);
    console.log(`  ✅ ${s.label} (${s.color})`);
  }
}
