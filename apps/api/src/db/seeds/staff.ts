import { eq } from 'drizzle-orm';
import { db } from '../index';
import { staff } from '../schema';

interface SeedStaff {
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
}

const SEED_STAFF: SeedStaff[] = [
  {
    name: 'Nicolás Herrera',
    email: 'nicolas.herrera@machbar.com',
    phone: '(212) 555-0210',
    isActive: true,
  },
  {
    name: 'Brianna Cole',
    email: 'brianna.cole@machbar.com',
    phone: '(201) 555-0221',
    isActive: true,
  },
  {
    name: 'Kevin Zhang',
    email: 'kevin.zhang@machbar.com',
    phone: '(203) 555-0232',
    isActive: true,
  },
  {
    name: 'Mariana López',
    email: 'mariana.lopez@machbar.com',
    phone: '(646) 555-0243',
    isActive: true,
  },
  {
    name: 'Derek Foster',
    email: 'derek.foster@machbar.com',
    phone: '(551) 555-0254',
    isActive: true,
  },
  {
    name: 'Ayesha Khan',
    email: 'ayesha.khan@machbar.com',
    phone: '(475) 555-0265',
    isActive: false,
  },
  {
    name: 'Pablo Sánchez',
    email: 'pablo.sanchez@machbar.com',
    phone: '(917) 555-0276',
    isActive: false,
  },
];

export async function seedStaff() {
  console.log('🧑‍🍳 Seeding staff...');

  for (const s of SEED_STAFF) {
    const [existing] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(eq(staff.email, s.email))
      .limit(1);
    if (existing) {
      console.log(`  ⏭️  ${s.email} ya existe, salteando`);
      continue;
    }

    await db.insert(staff).values(s);
    console.log(`  ✅ ${s.name}${s.isActive ? '' : ' (inactivo)'}`);
  }
}
