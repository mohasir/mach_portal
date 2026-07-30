import { eq } from 'drizzle-orm';
import type { Role } from '@repo/guards';
import { db } from '../index';
import { user } from '../schema';
import { auth } from '../../lib/auth';

const SEED_PASSWORD = process.env['SEED_PASSWORD'] ?? 'admin123*';

interface SeedUser {
  name: string;
  email: string;
  role: Role;
}

// Cuentas reales de acceso al panel — se siembran en cualquier entorno (prod y local).
const SEED_ADMIN_USERS: SeedUser[] = [
  { name: 'Samuel', email: 'samuel@admin.com', role: 'superadmin' },
  { name: 'Lucia', email: 'lucia@admin.com', role: 'admin' },
];

// Cuentas de prueba para desarrollo/demo — nunca en prod.
const SEED_DEMO_USERS: SeedUser[] = [
  { name: 'Carlos', email: 'carlos@demo.com', role: 'member' },
  { name: 'Ana', email: 'ana@demo.com', role: 'member' },
  { name: 'Luis', email: 'luis@demo.com', role: 'member' },
  { name: 'María', email: 'maria@demo.com', role: 'member' },
  { name: 'José', email: 'jose@demo.com', role: 'member' },
  { name: 'Sofía', email: 'sofia@demo.com', role: 'member' },
  { name: 'Miguel', email: 'miguel@demo.com', role: 'member' },
  { name: 'Valeria', email: 'valeria@demo.com', role: 'member' },
  { name: 'Daniel', email: 'daniel@demo.com', role: 'member' },
  { name: 'Elena', email: 'elena@demo.com', role: 'member' },
  { name: 'Javier', email: 'javier@demo.com', role: 'member' },
  { name: 'Camila', email: 'camila@demo.com', role: 'member' },
  { name: 'Andrés', email: 'andres@demo.com', role: 'member' },
  { name: 'Paula', email: 'paula@demo.com', role: 'member' },
  { name: 'Fernando', email: 'fernando@demo.com', role: 'member' },
];

async function seedUserList(users: SeedUser[]) {
  for (const u of users) {
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

export async function seedAdminUsers() {
  console.log('👤 Seeding usuarios admin...');
  await seedUserList(SEED_ADMIN_USERS);
}

export async function seedDemoUsers() {
  console.log('👤 Seeding usuarios demo...');
  await seedUserList(SEED_DEMO_USERS);
}
