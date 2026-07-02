# Boilerplate de Monorepo — Spec de Inicialización para Agente

> **Propósito**
> Este documento es una **especificación ejecutable**: un agente de IA lo lee y **genera desde cero un monorepo boilerplate** listo para arrancar cualquier proyecto con este stack. No describe un dominio concreto: produce un esqueleto reutilizable con **un slice vertical de ejemplo** (`notes`) que sirve de plantilla para copiar.
>
> Al terminar, el repo debe: instalar (`pnpm install`), levantar API y Web (`pnpm dev`), pasar tipos (`pnpm check-types`), autenticar con Better Auth y responder una query tRPC end-to-end tipada.
>
> **Regla de oro para el agente:** ejecuta las fases **en orden**. No inventes estructura fuera de la aquí descrita. Donde haya código, respétalo — son los puntos de integración críticos. Todo lo demás (CRUD repetitivo) sigue el patrón del slice `notes`.

---

## 0. Decisiones fijadas (no re-preguntar)

| Decisión | Valor |
| --- | --- |
| Tenancy | **Single-tenant** (sin organizaciones). Auth simple usuario/sesión con Better Auth. |
| Arquitectura BE | **Por capas**: `router (tRPC) → service → repository`. |
| Extras incluidos | **Docker Compose (Postgres)**, **validación de env con Zod**, **i18n (i18next)**. |
| Idioma del código | Inglés (identificadores, mensajes). i18n para texto de usuario. |
| No incluido (dejar para después) | CI/Vitest, multi-tenancy, envío de emails (reset password), logging estructurado, rate limiting. Ver §12. |

---

## 1. Stack

| Área | Tecnología |
| --- | --- |
| Monorepo | **Turborepo** + **pnpm workspaces** (pnpm@9, Node ≥ 20) |
| Lenguaje | **TypeScript** strict, ESM |
| **Backend** | **Express 5** + **tRPC v11** + **Zod 4**, **Drizzle ORM** sobre **PostgreSQL** (`postgres-js`) |
| **Auth** | **Better Auth** (email+password), adapter Drizzle, cliente React |
| **Frontend** | **Next.js 16** (App Router) + **React 19** |
| Datos FE | **tRPC client** + **@trpc/tanstack-react-query** + **TanStack Query v5** |
| Estado FE | **Zustand v5** |
| Formularios | **React Hook Form** + `@hookform/resolvers` + **Zod** |
| Tablas | **TanStack Table v8** |
| Estilos | **Tailwind CSS v4** |
| UI | **shadcn/ui** vía paquete **`@repo/ui`** |
| i18n | **i18next** + **react-i18next** |

### El porqué del stack (contrato de tipos end-to-end)

La razón de ser de este boilerplate es la **seguridad de tipos de la base de datos al navegador sin generar código**:

```
Drizzle schema ──> Repository ──> Service ──> tRPC procedure ──(export type AppRouter)──> tRPC client ──> React hooks
        ▲                                                                                                    │
        └──────────────── @repo/schemas (Zod) ── usado por tRPC .input()  Y  por RHF zodResolver() ─────────┘
```

- El backend exporta `type AppRouter`; el frontend lo importa **type-only** → autocompletado y tipos en cada llamada.
- Los **schemas Zod viven en `@repo/schemas`** y se usan en **ambos** lados: como `.input()` de las procedures y como `zodResolver()` de los formularios. Una sola fuente de verdad de validación.

---

## 2. Estructura final del monorepo (árbol objetivo)

```
<root>/
├── package.json                 # privado; scripts vía turbo
├── pnpm-workspace.yaml
├── turbo.json
├── .npmrc                        # node-linker / config pnpm
├── .nvmrc                        # versión de node
├── .gitignore
├── .prettierrc  .prettierignore
├── .editorconfig
├── docker-compose.yaml           # servicio postgres
│
├── apps/
│   ├── api/
│   │   ├── package.json          # name: "api"; exporta el tipo AppRouter
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   ├── .env.example
│   │   └── src/
│   │       ├── server.ts         # bootstrap Express (auth handler → json → trpc)
│   │       ├── env.ts            # validación de env con Zod
│   │       ├── index.ts          # export type { AppRouter }
│   │       ├── db/
│   │       │   ├── index.ts      # cliente drizzle (db)
│   │       │   └── schema/
│   │       │       ├── auth.ts   # tablas Better Auth (generadas por CLI)
│   │       │       ├── notes.ts  # tabla de ejemplo
│   │       │       └── index.ts  # barrel
│   │       ├── lib/
│   │       │   └── auth.ts       # instancia betterAuth
│   │       ├── trpc/
│   │       │   ├── context.ts    # createContext (sesión desde Better Auth)
│   │       │   ├── trpc.ts       # initTRPC, publicProcedure, protectedProcedure
│   │       │   └── router.ts     # appRouter + export type AppRouter
│   │       └── modules/
│   │           └── notes/        # SLICE DE EJEMPLO (plantilla)
│   │               ├── notes.router.ts
│   │               ├── notes.service.ts
│   │               └── notes.repository.ts
│   │
│   └── web/
│       ├── package.json          # name: "web"; depende de "api" (workspace, type-only)
│       ├── tsconfig.json
│       ├── next.config.ts
│       ├── postcss.config.mjs
│       ├── components.json        # shadcn (apunta a @repo/ui)
│       ├── .env.example
│       └── src/
│           ├── env.ts
│           ├── app/
│           │   ├── layout.tsx
│           │   ├── page.tsx
│           │   └── providers.tsx  # Providers de cliente (RQ + tRPC + i18n)
│           ├── lib/
│           │   ├── trpc/
│           │   │   ├── client.ts  # createTRPCContext<AppRouter>()
│           │   │   └── provider.tsx
│           │   ├── auth/
│           │   │   └── client.ts  # createAuthClient (better-auth/react)
│           │   ├── i18n/
│           │   └── stores/        # zustand
│           └── features/
│               └── notes/         # SLICE DE EJEMPLO (plantilla)
│                   ├── hooks/useNotes.ts
│                   ├── components/NotesPage.tsx
│                   └── index.ts
│
└── packages/
    ├── typescript-config/         # @repo/typescript-config (base.json, nextjs.json)
    ├── eslint-config/             # @repo/eslint-config
    ├── schemas/                   # @repo/schemas  (Zod compartido BE↔FE)
    │   ├── package.json
    │   └── src/
    │       ├── index.ts
    │       └── notes.ts           # createNoteSchema, updateNoteSchema (ejemplo)
    └── ui/                        # @repo/ui  (shadcn + Tailwind)
        ├── package.json
        ├── components.json
        └── src/
            ├── components/        # componentes shadcn
            ├── lib/utils.ts       # cn()
            └── index.ts           # barrel de exports
```

### Convenciones globales

- **pnpm workspaces**: `apps/*` y `packages/*`. Deps internas con `workspace:*`.
- **Path aliases** por app: `@/*` → `src/*`. Paquetes compartidos por nombre: `@repo/ui`, `@repo/schemas`, `@repo/typescript-config`, `@repo/eslint-config`.
- **Type-sharing**: `apps/web` declara `"api": "workspace:*"` y hace `import type { AppRouter } from 'api'` (solo tipos, sin acoplamiento en runtime).
- TS `strict: true`, ESM (`"type": "module"`).

---

## 3. Fase 0 — Raíz del monorepo

Crear en la raíz:

**`pnpm-workspace.yaml`**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**`package.json`** (raíz, privado)
```json
{
  "name": "monorepo-boilerplate",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "check-types": "turbo run check-types",
    "db:push": "turbo run db:push",
    "format": "prettier --write \"**/*.{ts,tsx,md}\""
  },
  "devDependencies": {
    "prettier": "^3",
    "turbo": "^2",
    "typescript": "^5.7"
  }
}
```

**`turbo.json`**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "check-types": { "dependsOn": ["^build"] },
    "db:push": { "cache": false }
  }
}
```

Además: `.npmrc`, `.nvmrc` (ej. `20`), `.gitignore` (node_modules, dist, .next, .env, .turbo), `.prettierrc`, `.editorconfig`.

**`docker-compose.yaml`** (Postgres local)
```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
volumes:
  pgdata:
```

---

## 4. Fase 1 — Paquetes de configuración compartida

### `packages/typescript-config`
`package.json` con `"name": "@repo/typescript-config"` y archivos `base.json` y `nextjs.json`.

`base.json`:
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### `packages/eslint-config`
`"name": "@repo/eslint-config"`, ESLint 9 flat config (base + next). Exporta configs reutilizables.

---

## 5. Fase 2 — `@repo/schemas` (Zod compartido)

El paquete que rompe la duplicación de validación entre BE y FE.

**`packages/schemas/package.json`**
```json
{
  "name": "@repo/schemas",
  "version": "0.0.0",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "zod": "^4" }
}
```

**`packages/schemas/src/notes.ts`** (ejemplo — plantilla)
```ts
import { z } from 'zod';

export const createNoteSchema = z.object({
  title: z.string().min(1, 'notes.validation.titleRequired').max(120),
  content: z.string().max(5000).optional(),
});

export const updateNoteSchema = createNoteSchema.partial();

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
```
> Los mensajes son **claves i18n** (se traducen en el front). El BE los usa como `.input()`; el FE como `zodResolver()`.

`src/index.ts` reexporta todo (`export * from './notes'`).

---

## 6. Fase 3 — `@repo/ui` (shadcn + Tailwind)

1. Crear `packages/ui/package.json` (`"name": "@repo/ui"`, `type: module`, exports por subpath).
2. Inicializar shadcn **dentro del paquete**: `pnpm dlx shadcn@latest init` en `packages/ui` (Tailwind v4, base color, `cn` en `src/lib/utils.ts`).
3. Añadir componentes: `pnpm dlx shadcn@latest add button input dialog table select` (etc.).
4. `src/index.ts` reexporta los componentes: `export { Button } from './components/button'`, etc.
5. Config de monorepo shadcn: `apps/web/components.json` con `"aliases": { "ui": "@repo/ui" }` para que `shadcn add` en el futuro instale en el paquete.

> **Regla:** las primitivas de UI viven **solo** en `@repo/ui`. Las apps las consumen por `import { Button } from '@repo/ui'`. No duplicar.

---

## 7. Fase 4 — `apps/api` (Express + tRPC + Drizzle + Better Auth)

### 7.1 Dependencias
```
prod: express cors @trpc/server zod drizzle-orm postgres better-auth dotenv
dev:  typescript tsx drizzle-kit @better-auth/cli esbuild @types/express @types/cors
      @repo/typescript-config @repo/eslint-config @repo/schemas
```

**`package.json`** (clave: exporta el tipo del router)
```json
{
  "name": "api",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "esbuild src/server.ts --bundle --platform=node --format=esm --outfile=dist/server.js --packages=external",
    "start": "node dist/server.js",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "auth:generate": "better-auth generate --output src/db/schema/auth.ts",
    "check-types": "tsc --noEmit",
    "lint": "eslint ."
  }
}
```

### 7.2 Env validado con Zod — `src/env.ts`
```ts
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.string().url(),      // ej. http://localhost:8080
  WEB_ORIGIN: z.string().url(),           // ej. http://localhost:3000
  PORT: z.coerce.number().default(8080),
});

export const env = schema.parse(process.env);
```
`.env.example`: `DATABASE_URL=postgres://app:app@localhost:5432/app`, `BETTER_AUTH_SECRET=...`, `BETTER_AUTH_URL=http://localhost:8080`, `WEB_ORIGIN=http://localhost:3000`, `PORT=8080`.

### 7.3 DB — `src/db/index.ts`
```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '../env';

export const queryClient = postgres(env.DATABASE_URL);
export const db = drizzle(queryClient, { schema });
export type Database = typeof db;
```
`drizzle.config.ts` apunta a `./src/db/schema` y usa `env.DATABASE_URL`.

### 7.4 Better Auth — `src/lib/auth.ts`
```ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db';
import { env } from '../env';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.WEB_ORIGIN],
});
```
> Tras crear esto, correr `pnpm auth:generate` para generar `src/db/schema/auth.ts` (tablas `user`, `session`, `account`, `verification`), reexportarlas en `src/db/schema/index.ts` y `pnpm db:push`.

### 7.5 tRPC context — `src/trpc/context.ts`
```ts
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../lib/auth';

export async function createContext({ req, res }: CreateExpressContextOptions) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  return { req, res, session }; // session: { user, session } | null
}
export type Context = Awaited<ReturnType<typeof createContext>>;
```

### 7.6 tRPC init + procedures — `src/trpc/trpc.ts`
```ts
import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, user: ctx.session.user, session: ctx.session } });
});
```

### 7.7 Slice de ejemplo — `src/modules/notes/`

**`notes.repository.ts`** (acceso a datos; recibe `Database`)
```ts
import { eq } from 'drizzle-orm';
import type { Database } from '../../db';
import { notes } from '../../db/schema';

export class NotesRepository {
  constructor(private db: Database) {}
  findAllByUser(userId: string) { return this.db.select().from(notes).where(eq(notes.userId, userId)); }
  create(data: typeof notes.$inferInsert) { return this.db.insert(notes).values(data).returning().then(r => r[0]); }
  // update / delete ...
}
```

**`notes.service.ts`** (lógica de negocio; lanza `TRPCError`)
```ts
import { TRPCError } from '@trpc/server';
import { NotesRepository } from './notes.repository';
import type { CreateNoteInput } from '@repo/schemas';

export class NotesService {
  constructor(private repo: NotesRepository) {}
  list(userId: string) { return this.repo.findAllByUser(userId); }
  async create(userId: string, input: CreateNoteInput) {
    const note = await this.repo.create({ ...input, userId });
    if (!note) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    return note;
  }
}
```

**`notes.router.ts`** (procedures; validan con `@repo/schemas`)
```ts
import { router, protectedProcedure } from '../../trpc/trpc';
import { createNoteSchema } from '@repo/schemas';
import { db } from '../../db';
import { NotesRepository } from './notes.repository';
import { NotesService } from './notes.service';

const service = new NotesService(new NotesRepository(db));

export const notesRouter = router({
  list:   protectedProcedure.query(({ ctx }) => service.list(ctx.user.id)),
  create: protectedProcedure.input(createNoteSchema)
            .mutation(({ ctx, input }) => service.create(ctx.user.id, input)),
});
```
> **Capas:** `router` (transporte + validación) → `service` (negocio) → `repository` (datos). Igual filosofía que el proyecto de referencia, adaptada a tRPC (el `router` sustituye a `controller`+`routes`; ya no hay `resource` porque tRPC serializa e infiere el tipo de salida directamente).

### 7.8 Router raíz — `src/trpc/router.ts` + `src/index.ts`
```ts
// router.ts
import { router } from './trpc';
import { notesRouter } from '../modules/notes/notes.router';
export const appRouter = router({ notes: notesRouter });
export type AppRouter = typeof appRouter;
```
```ts
// index.ts  (superficie que consume el frontend, type-only)
export type { AppRouter } from './trpc/router';
```

### 7.9 Bootstrap Express — `src/server.ts`  ⚠️ orden crítico
```ts
import express from 'express';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { auth } from './lib/auth';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';
import { env } from './env';

const app = express();

app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));

// 1) Better Auth ANTES de express.json() (parsea su propio body)
app.all('/api/auth/*', toNodeHandler(auth));

// 2) JSON parser para el resto
app.use(express.json());

// 3) tRPC
app.use('/trpc', createExpressMiddleware({ router: appRouter, createContext }));

app.listen(env.PORT, () => console.log(`API on :${env.PORT}`));
```
> **Errores comunes que el agente DEBE evitar:** montar `express.json()` antes del handler de Better Auth (rompe el login); olvidar `credentials: true` en CORS (las cookies de sesión no viajan); usar `origin: '*'` con credentials (el navegador lo rechaza).

---

## 8. Fase 5 — `apps/web` (Next + tRPC client + RQ + Zustand + RHF + Table + i18n)

### 8.1 Dependencias
```
prod: next react react-dom
      @trpc/client @trpc/tanstack-react-query @tanstack/react-query @tanstack/react-table
      zustand react-hook-form @hookform/resolvers zod
      better-auth i18next react-i18next lucide-react
      tailwindcss @tailwindcss/postcss
      @repo/ui @repo/schemas api            # <-- api es workspace, solo tipos
dev:  typescript @types/react @types/react-dom @repo/typescript-config @repo/eslint-config
```
`package.json` → `"dependencies": { "api": "workspace:*", "@repo/ui": "workspace:*", "@repo/schemas": "workspace:*" }`.

### 8.2 tRPC client (integración TanStack Query) — `src/lib/trpc/client.ts`
```ts
import { createTRPCContext } from '@trpc/tanstack-react-query';
import type { AppRouter } from 'api';

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
```

### 8.3 Providers — `src/lib/trpc/provider.tsx`
```tsx
'use client';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from 'api';
import { TRPCProvider } from './client';
import { env } from '@/env';

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
  }));
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({
        url: `${env.NEXT_PUBLIC_API_URL}/trpc`,
        fetch: (url, opts) => fetch(url, { ...opts, credentials: 'include' }), // cookies Better Auth
      })],
    }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>{children}</TRPCProvider>
    </QueryClientProvider>
  );
}
```
`src/app/providers.tsx` compone: `TranslationsProvider (i18n) → TRPCReactProvider → children`. `app/layout.tsx` lo monta alrededor de `{children}`.

### 8.4 Better Auth client — `src/lib/auth/client.ts`
```ts
import { createAuthClient } from 'better-auth/react';
import { env } from '@/env';

export const authClient = createAuthClient({ baseURL: env.NEXT_PUBLIC_API_URL }); // ej. http://localhost:8080
export const { signIn, signUp, signOut, useSession } = authClient;
```
> `NEXT_PUBLIC_API_URL` = origen de la API (`http://localhost:8080`). Better Auth añade `/api/auth`. tRPC usa `${NEXT_PUBLIC_API_URL}/trpc`.

### 8.5 Slice de ejemplo — `src/features/notes/`

**`hooks/useNotes.ts`** (data via tRPC + RQ; form via RHF + @repo/schemas)
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createNoteSchema, type CreateNoteInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';

export function useNotesList() {
  const trpc = useTRPC();
  return useQuery(trpc.notes.list.queryOptions());
}

export function useCreateNote() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const form = useForm<CreateNoteInput>({
    resolver: zodResolver(createNoteSchema),
    defaultValues: { title: '', content: '' },
  });
  const mutation = useMutation(trpc.notes.create.mutationOptions({
    onSuccess: () => qc.invalidateQueries(trpc.notes.list.queryFilter()),
  }));
  const onSubmit = form.handleSubmit((data) => mutation.mutateAsync(data));
  return { form, onSubmit, isPending: mutation.isPending };
}
```
> El tipo de `data` en `useNotesList` se **infiere del `AppRouter`** — cero tipos escritos a mano. Para tipos explícitos: `inferRouterOutputs<AppRouter>` desde `@trpc/server`.

**`components/NotesPage.tsx`**: `'use client'`, consume los hooks, renderiza con `@repo/ui` (`Button`, `Input`, `Table`) y `useTranslation('notes')`.

**`index.ts`**: barrel público de la feature.

### 8.6 Zustand — `src/lib/stores/`
Patrón `create(persist((set) => ({...}), { name }))` para estado de UI/preferencias. **No** cachear datos de servidor aquí (eso es React Query).

### 8.7 i18n
`src/lib/i18n/config.ts` con `locales: ['es','en']`, `defaultLocale: 'es'`, namespaces (`['common','notes']`). Recursos en `src/locales/{es,en}/*.json`. Las claves de validación de `@repo/schemas` (`notes.validation.*`) se resuelven aquí.

---

## 9. Fase 6 — Cableado de tipos (verificación del contrato)

1. `apps/web/package.json` incluye `"api": "workspace:*"`.
2. `apps/web/tsconfig.json` extiende `@repo/typescript-config/nextjs.json` y define `paths` (`@/*`).
3. En el web, **siempre** `import type { AppRouter } from 'api'` (nunca importar valores del backend en el cliente).
4. `pnpm install` en la raíz enlaza los workspaces.

---

## 10. Fase 7 — Arranque y verificación (el agente debe ejecutarlo)

```bash
docker compose up -d db          # Postgres
pnpm install                     # instala y enlaza workspaces
cp apps/api/.env.example apps/api/.env   # y completar secretos
cp apps/web/.env.example apps/web/.env
pnpm --filter api auth:generate  # genera schema de Better Auth
pnpm --filter api db:push        # crea tablas (auth + notes)
pnpm check-types                 # 0 errores de tipos (contrato OK)
pnpm dev                         # API :8080 + Web :3000
```

**Criterios de aceptación (Definition of Done):**
- [ ] `pnpm check-types` pasa sin errores (el `AppRouter` fluye al front).
- [ ] `/api/auth` responde; `signUp`/`signIn` desde el web crean sesión (cookie presente).
- [ ] `trpc.notes.list` devuelve `[]` autenticado y **401/UNAUTHORIZED** sin sesión.
- [ ] Crear una nota vía formulario (RHF+Zod) la persiste y refresca la lista (invalidación RQ).
- [ ] Un componente de `@repo/ui` (shadcn) renderiza en el web.
- [ ] Cambiar de idioma con i18n cambia los textos.

---

## 11. Convenciones de nombres (resumen)

| Elemento | Convención | Ejemplo |
| --- | --- | --- |
| Router tRPC (feature) | `<feature>Router` | `notesRouter` |
| Service / Repository | `PascalCase` + sufijo | `NotesService`, `NotesRepository` |
| Schema Zod compartido | `<accion><Entidad>Schema` en `@repo/schemas` | `createNoteSchema` |
| Tipo input inferido | `z.infer` | `CreateNoteInput` |
| Hook de datos FE | `useX` / `useXList` | `useNotesList` |
| Componente Page | `XPage` | `NotesPage` |
| Store Zustand | `useXStore` | `useUiStore` |
| Tabla DB | plural snake_case | `notes` |

---

## 12. Qué NO incluye este boilerplate (considéralo después)

Señalado explícitamente para que no te sorprenda al crecer:

- **Tests / CI**: no se incluyó Vitest ni workflow de CI. Añadir `vitest` por app y un `.github/workflows/ci.yml` cuando haga falta.
- **Multi-tenancy**: es single-tenant. Si en el futuro necesitas organizaciones, Better Auth tiene el **plugin `organization`** (añade `organizationId` al scope; los repositories filtrarían por él).
- **Emails** (reset password / verificación): Better Auth requiere un proveedor de email para esos flujos. Configurar `sendResetPassword`, etc.
- **Logging estructurado** (pino), **rate limiting**, **helmet**: añadir en `server.ts` para producción.
- **Manejo de errores tRPC → i18n**: definir un `errorFormatter` en `initTRPC` y mapear `error.code`/mensajes a claves i18n en el front (equivalente al `errorCode` del proyecto de referencia).
- **Prefetch en Server Components**: `@trpc/tanstack-react-query` soporta hidratación desde RSC; se puede añadir un `HydrationBoundary` para SSR de datos.
- **Deploy**: variables de entorno de producción, build de la API (`esbuild`) y de Next, y CORS/`trustedOrigins` con los dominios reales.

---

## 13. Anti-patrones (qué NO hacer)

- ❌ Importar **valores** del backend en el frontend (solo `import type { AppRouter }`).
- ❌ Montar `express.json()` antes del handler de Better Auth.
- ❌ CORS sin `credentials: true` o con `origin: '*'` cuando hay cookies.
- ❌ Duplicar schemas Zod en front y back en vez de usar `@repo/schemas`.
- ❌ Escribir tipos de respuesta a mano en el front (se infieren del `AppRouter`).
- ❌ Poner lógica de negocio en el `router` tRPC o en el `repository` (va en el `service`).
- ❌ Acceso a DB fuera de un `repository`.
- ❌ Guardar datos de servidor en Zustand (usar TanStack Query).
- ❌ Duplicar componentes de UI en las apps en vez de `@repo/ui`.
- ❌ Texto hardcodeado en la UI en vez de i18n.
```
