import { eq } from 'drizzle-orm';
import type { Role } from '@repo/auth';
import { db } from '../index';
import { user } from '../schema';
import { auth } from '../../lib/auth';


const SEED_PASSWORD = process.env['SEED_PASSWORD'] ?? 'admin123*';

interface SeedUser {
  name: string;
  email: string;
  role: Role;
}

const SEED_USERS: SeedUser[] = [
  { name: 'Samuel', email: 'samuel@mach.local', role: 'superadmin' },
  { name: 'Lucia', email: 'lucia@mach.local', role: 'admin' },
  { name: 'Demo', email: 'demo@mach.local', role: 'member' },
];

export async function seedUsers() {
  console.log('👤 Seeding usuarios...');

  for (const u of SEED_USERS) {
    const [existing] = await db.select().from(user).where(eq(user.email, u.email)).limit(1);
    if (existing) {
      console.log(`  ⏭️  ${u.email} ya existe, salteando`);
      continue;
    }

    // Se crea vía Better Auth para que hashee el password y cree la fila `account`
    // (providerId 'credential'). Un insert directo NO permitiría iniciar sesión.
    await auth.api.signUpEmail({ body: { name: u.name, email: u.email, password: SEED_PASSWORD } });

    // signUp asigna DEFAULT_ROLE ('member'); sobrescribimos con el rol del seed.
    await db.update(user).set({ role: u.role }).where(eq(user.email, u.email));

    console.log(`  ✅ ${u.email} (${u.role})`);
  }
}
