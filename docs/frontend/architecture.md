# Especificación de Arquitectura — Frontend (Web)

> **Propósito de este documento**
> Es una *especificación de arquitectura orientada a IA* (Spec-Driven Development). Describe **cómo está construido** el frontend de `mach-portal` y, sobre todo, **las reglas que un agente de IA debe seguir** para añadir o modificar código de forma consistente.
>
> No es un README de "cómo correr el proyecto". Es el contrato de cómo se escribe el código.
>
> Stack real: **Next.js 15 + AntD v6 + tRPC v11 + Better Auth + Drizzle**, monorepo Turborepo/pnpm. Cualquier ejemplo concreto (`notes`) es ilustrativo; el patrón es lo que importa. El frontend consume la API tRPC descrita por `apps/api`, y **comparte con ella los schemas Zod de `@repo/schemas` y la inferencia de tipos del router**.
>
> Este documento acompaña a `styling-guide.md` (sistema de tokens AntD ↔ Tailwind). Para todo lo visual, esa guía manda.

---

## 1. Stack y principios

| Capa | Tecnología |
| --- | --- |
| Framework | **Next.js 15** (App Router) |
| UI runtime | **React 19** |
| API / RPC | **tRPC v11** (`@trpc/client`, `@trpc/tanstack-react-query`) |
| Estado de servidor | **TanStack Query v5** (integrado con tRPC) |
| Estado de cliente | **Zustand v5** (con `persist` cuando aplica) |
| Auth | **Better Auth** (`better-auth/react`, sesión por cookie) |
| Formularios | **AntD `Form`** nativo |
| Validación / contrato | **Zod 4** compartido vía **`@repo/schemas`** |
| Componentes | **Ant Design v6** |
| Estilos | **Tailwind CSS v4** sobre tokens AntD (ver `styling-guide.md`) |
| i18n | **i18next** + **react-i18next** (namespaces) |
| Iconos | `@ant-design/icons` |
| Monorepo | **Turborepo** + **pnpm workspaces** |

### Principios no negociables

1. **Feature-Sliced.** El código de dominio vive en `src/features/<feature>/`. Cada feature es autónoma y expone su API pública por un barrel `index.ts`. Las páginas del App Router son *thin*: solo importan y renderizan el componente índice de la feature.
2. **Separación estricta de capas dentro de la feature:** `hooks` (wrappers tRPC + acciones) → `components` (UI). Un componente **nunca** llama a `useTRPC()` directamente ni arma `queryOptions()`/`queryFilter()` inline: pasa siempre por un hook de la feature.
3. **Estado de servidor ≠ estado de cliente.** Datos que vienen de la API → **tRPC + TanStack Query**. Estado de UI/preferencias/config global → **Zustand**. No se mezclan (no se cachea data de servidor en Zustand).
4. **El contrato es Zod (`@repo/schemas`).** Todo input de una mutation/query tRPC se valida con un schema Zod compartido; ese schema es la **fuente de verdad de la validación** y del tipo del input. La validación en el `<Form>` de AntD (`rules`) es de **UX** (feedback inmediato); el backend es el límite real de validación.
5. **Tipos inferidos, no escritos a mano.** Los tipos de request salen de `@repo/schemas` (`z.infer`) y los de response de `inferRouterOutputs<AppRouter>`. No se declaran DTOs manuales que dupliquen el contrato.
6. **Errores de API centralizados.** Todo error de tRPC se normaliza y se traduce a mensaje i18n mediante su `errorCode`/`code` (`useApiError`). No se leen `error.message` crudos sueltos por la UI.
7. **Autorización declarativa (opt-in).** Cuando el proyecto usa RBAC, la visibilidad por permisos/roles se expresa con `<Can>` y `useCan`, sobre el catálogo de access-control compartido de Better Auth. Nunca condicionales ad-hoc con strings de rol.
8. **Todo texto visible pasa por i18n.** Nada de strings hardcodeados en la UI; se usan claves de namespace (`useTranslation('<feature>')`).

> **Qué desaparece respecto de una arquitectura basada en Axios/REST:** no hay `services/` con llamadas HTTP, no hay instancias axios ni interceptores, no hay cola de refresh de tokens, no hay factory manual de query keys, no hay DTOs escritos a mano. tRPC + Better Auth cubren todo eso.

---

## 2. Estructura de directorios

```
apps/web/src/
├── app/                        # App Router. Páginas THIN + layouts.
│   ├── layout.tsx              # Root layout (fuentes, AntdRegistry, <Providers>)
│   ├── providers.tsx           # Composición de providers (client)
│   ├── (auth)/                 # Grupo de rutas públicas (login/registro)
│   └── (app)/                  # Grupo protegido
│       ├── layout.tsx          # Layout del panel (sidebar/topbar) + guard de sesión
│       └── <recurso>/page.tsx  # Página: renderiza el índice de la feature
│
├── features/                   # DOMINIO. Un directorio por feature.
│   └── <feature>/
│       ├── components/         # UI AntD (Page, Table, Form, Modal, columns)
│       ├── hooks/              # useXList/useXCreate... (wrappers tRPC) + useXActions
│       ├── types.ts            # (opcional) re-export de tipos INFERIDOS del router
│       └── index.ts            # BARREL: API pública de la feature
│
├── lib/                        # Infraestructura transversal (no dominio)
│   ├── trpc/                   # client.ts (useTRPC), provider.tsx, types.ts (RouterInputs/Outputs)
│   ├── auth/                   # client.ts (authClient, signIn/Out, useSession), guards, <Can>/useCan
│   ├── i18n/                   # config.ts
│   ├── error/                  # useApiError.ts (parser tRPC → i18n)
│   ├── stores/                 # Zustand stores (locale, ui, ...)
│   └── env.ts                  # Variables de entorno validadas
│
├── components/                 # Componentes GLOBALES (no de una feature)
│   ├── layout/                 # AppSidebar, AppTopbar, AppShell
│   └── shared/                 # PageHeader, DataTable, ConfirmDelete, ...
│
├── theme/                      # antd.ts (tokens MB + machBarTheme), globals.css
└── locales/{es,en}/            # common.json, <feature>.json, api.json
```

Los schemas Zod **no** viven en la feature del web: viven en **`packages/schemas/src/<feature>.ts`** y se importan por `@repo/schemas`. Así el mismo schema valida el input en el router tRPC (backend) y provee el tipo/validación en el front.

### Path aliases (tsconfig)

Hoy el proyecto usa un único alias raíz:

```
@/*   → src/*
```

Se importa entonces `@/features/...`, `@/lib/...`, `@/components/...`, `@/theme/...`. Paquetes del monorepo por nombre: **`api`** (tipo `AppRouter`), **`@repo/schemas`** (Zod + tipos de input).

---

## 3. Anatomía de una feature (el patrón canónico)

Con tRPC, la feature se **aplana** a dos capas: `hooks` (datos) y `components` (UI). El "service" y el "factory de query keys" del patrón REST clásico los provee tRPC.

| Capa | Archivo(s) | Responsabilidad | Qué NO hace |
| --- | --- | --- | --- |
| **Schema (compartido)** | `@repo/schemas/src/<x>.ts` | Schemas Zod de input (`createXSchema`, `updateXSchema`) + tipos (`z.infer`). Fuente de verdad del contrato. | Nada de React ni de HTTP. |
| **Types** | `types.ts` *(opcional)* | Re-export de tipos **inferidos** del router (`RouterOutputs['x']['list'][number]`). | Declarar formas a mano. |
| **Data hooks** | `hooks/useX.ts` | Envuelven `useTRPC()` con `useQuery`/`useMutation`. Centralizan la invalidación de cache. Manejo de error con `useApiError`. | Renderizar UI, validar formularios de UX. |
| **Action hook** | `hooks/useXActions.ts` *(opcional)* | Handlers de acciones de tabla (editar, borrar con confirm, copiar id...). | Llamar a `useTRPC()` a mano. |
| **Components** | `components/*.tsx` | UI AntD. Consumen los hooks. `Page` orquesta; `Table`/`columns`, `Modal`, `Form`. | `useTRPC()` directo, `queryOptions()` inline. |
| **Barrel** | `index.ts` | Exporta la API pública (componente índice, hooks, tipos). | — |

### 3.1 Schema (`@repo/schemas/src/<x>.ts`)

Los mensajes de validación son **claves i18n** (no texto). El schema es idéntico al que consume el router.

```ts
// packages/schemas/src/notes.ts
import { z } from 'zod';

export const createNoteSchema = z.object({
  title: z.string().min(1, 'notes.validation.titleRequired').max(120),
  content: z.string().max(5000).optional(),
});

export const updateNoteSchema = createNoteSchema.partial();

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
```

### 3.2 Types inferidos (`types.ts`)

Nunca se escribe la entidad a mano: se infiere del router. Helper global en `lib/trpc/types.ts`:

```ts
// lib/trpc/types.ts
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
```

```ts
// features/notes/types.ts
import type { RouterOutputs } from '@/lib/trpc/types';
export type Note = RouterOutputs['notes']['list'][number];
```

### 3.3 Data hooks (`hooks/useX.ts`)

Toda interacción con tRPC pasa por acá. tRPC genera las query keys; la invalidación se hace con `queryFilter()`.

```ts
// features/notes/hooks/useNotes.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateNoteInput, UpdateNoteInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useNotesList() {
  const trpc = useTRPC();
  return useQuery(trpc.notes.list.queryOptions());
}

export function useCreateNote() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.notes.create.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.notes.list.queryFilter()),
      onError,
    }),
  );

  return { createNote: (data: CreateNoteInput) => mutation.mutateAsync(data), isPending: mutation.isPending };
}

export function useUpdateNote() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.notes.update.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.notes.list.queryFilter()),
      onError,
    }),
  );

  return {
    updateNote: (id: string, data: UpdateNoteInput) => mutation.mutateAsync({ id, data }),
    isPending: mutation.isPending,
  };
}
```

Convenciones de los data hooks:
- Nombres: `useXList` / `useX(id)` (lecturas), `useCreateX` / `useUpdateX` / `useDeleteX` (escrituras).
- Query keys y su invalidación **siempre** vía el proxy tRPC (`trpc.x.y.queryOptions()`, `trpc.x.y.queryFilter()`). Nunca arrays a mano.
- Tras mutar, **invalidar** las queries afectadas en `onSuccess`.
- El manejo de error de la mutation se delega a `useApiError` (§5). Un `try/catch` local solo cuando se necesita lógica extra (ej. cerrar un modal).
- Queries dependientes de un id → opción `enabled: !!id` dentro de `queryOptions({ enabled })`.

### 3.4 Formulario (AntD `Form` + `@repo/schemas` como contrato)

El formulario usa `Form` nativo de AntD. La validación de UX se declara con `rules`; el input que sale del form **debe** satisfacer el schema de `@repo/schemas` (lo garantiza el tipo `CreateNoteInput` en `Form.useForm<...>()` y, en última instancia, el backend).

```tsx
// features/notes/components/NoteForm.tsx
'use client';
import { Form, Input, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CreateNoteInput } from '@repo/schemas';

export function NoteForm({ onSubmit, isPending }: {
  onSubmit: (values: CreateNoteInput) => Promise<void> | void;
  isPending: boolean;
}) {
  const { t } = useTranslation('notes');
  const [form] = Form.useForm<CreateNoteInput>();

  return (
    <Form form={form} layout="vertical" onFinish={onSubmit} requiredMark={false}>
      <Form.Item
        name="title"
        label={t('form.title')}
        rules={[{ required: true, message: t('validation.titleRequired') }, { max: 120 }]}
      >
        <Input placeholder={t('form.titlePlaceholder')} />
      </Form.Item>

      <Form.Item name="content" label={t('form.content')} rules={[{ max: 5000 }]}>
        <Input.TextArea rows={3} placeholder={t('form.contentPlaceholder')} />
      </Form.Item>

      <Form.Item className="mb-0">
        <Button type="primary" htmlType="submit" loading={isPending} block>
          {t('form.save')}
        </Button>
      </Form.Item>
    </Form>
  );
}
```

Reglas del formulario:
- El tipo genérico de `Form.useForm<T>()` es el **input inferido de `@repo/schemas`** (`CreateNoteInput`), no un tipo ad-hoc.
- Las `rules` reflejan las restricciones del schema (required, max, type). Son de **UX**; la validación autoritativa la hace el backend con el mismo Zod.
- Los mensajes de las `rules` son claves i18n (`t('validation.xxx')`).
- El componente `Form` **no** conoce las mutations: recibe `onSubmit`/`isPending` desde arriba (la Page los conecta al hook).
- **Opcional (formularios complejos):** un bridge Zod→rules para no duplicar restricciones. Ver §5.3.

### 3.5 Components

Jerarquía típica de una feature CRUD:

- **`XPage` / `XPageIndex`** (`'use client'`): orquesta. Renderiza `PageHeader`, la tabla y los modales; conecta hooks con componentes; maneja estado local de "qué modal está abierto" y "qué fila se edita".
- **`XTable` + `columns.tsx`**: `Table` de AntD; consume `useXList`.
- **`CreateXModal` / `EditXModal`**: `Modal` de AntD que envuelve `XForm`.
- **`XForm`**: campos AntD; recibe `onSubmit`/`isPending`.

```tsx
// features/notes/components/NotesPage.tsx
'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import { NotesTable } from './NotesTable';
import { CreateNoteModal } from './CreateNoteModal';
import type { Note } from '../types';

export function NotesPage() {
  const { t } = useTranslation('notes');
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);

  return (
    <div>
      <PageHeader title={t('index.title')} actionLabel={t('index.add')} onAction={() => setCreateOpen(true)} />
      <NotesTable onEdit={setEditing} />
      <CreateNoteModal open={isCreateOpen} onClose={() => setCreateOpen(false)} />
      {/* EditNoteModal note={editing} ... */}
    </div>
  );
}
```

### 3.6 Barrel (`index.ts`)

La única superficie pública de la feature. Las páginas y otras features importan **de aquí**, no de rutas internas.

```ts
export { NotesPage } from './components/NotesPage';
export { useNotesList, useCreateNote, useUpdateNote } from './hooks/useNotes';
export type { Note } from './types';
```

---

## 4. App Router: páginas thin + layouts + providers

- **Página** = adaptador de ruta. Solo renderiza el índice de la feature:
  ```tsx
  // app/(app)/notes/page.tsx
  import { NotesPage } from '@/features/notes';
  export default function Page() { return <NotesPage />; }
  ```
- **Grupos de ruta**: `(auth)` para páginas públicas (login/registro), `(app)` para el panel protegido.
- **Layouts** delegan en contenedores de `components/layout`:
  - `app/layout.tsx` → fuentes (Marcellus / Work Sans), `AntdRegistry layer`, `<Providers>`.
  - `app/(app)/layout.tsx` → `AppShell` (sidebar + topbar) + **guard de sesión** (redirige a login si no hay sesión).

### Composición de providers (`app/providers.tsx`)

Orden **exacto** (de fuera hacia dentro). Con Better Auth **no** hace falta un `AuthProvider` que hidrate tokens: la sesión vive en la cookie y `useSession()` la resuelve.

```
ConfigProvider (AntD theme = machBarTheme)   # tokens de diseño
└── App (AntD)                               # contexto para message/notification/modal
    └── I18nextProvider                       # i18n disponible para todo
        └── TRPCReactProvider                 # QueryClient + tRPC client (credentials: 'include')
            └── {children}
```

- El `App` de AntD debe envolver todo lo que use `App.useApp()` (mensajes/errores). Por eso va por fuera de tRPC.
- El `httpBatchLink` de tRPC usa `fetch(..., { credentials: 'include' })` para que Better Auth reciba la cookie de sesión en cada request.

### Protección de rutas

Dos capas complementarias:
1. **Guard de layout** (cliente): `app/(app)/layout.tsx` usa `useSession()`; mientras resuelve muestra loader, si no hay sesión redirige a `/login`.
2. **Middleware (recomendado):** `middleware.ts` lee la cookie de sesión de Better Auth (helper `getSessionCookie`) para redirigir en el borde sin renderizar el layout protegido. No confía en la cookie como autorización — solo como *hint* de redirección; la autorización real la hace la API.

---

## 5. Capa de datos y errores (tRPC)

### 5.1 Cliente tRPC (`lib/trpc/`)

```ts
// lib/trpc/client.ts
'use client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import type { AppRouter } from 'api';
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
```

```tsx
// lib/trpc/provider.tsx  (extracto)
const [trpcClient] = useState(() =>
  createTRPCClient<AppRouter>({
    links: [httpBatchLink({
      url: `${env.NEXT_PUBLIC_API_URL}/trpc`,
      fetch: (url, opts) => fetch(url, { ...opts, credentials: 'include' }),
    })],
  }),
);
```

`QueryClient` con defaults: `staleTime: 60_000`, `retry: 1`.

### 5.2 Errores centralizados (`lib/error/useApiError.ts`)

El backend expone un `errorCode` estable en el `errorFormatter` de tRPC; el front lo traduce contra el namespace `api`.

**Backend** (`apps/api/src/trpc/trpc.ts`): el `errorFormatter` adjunta el código propio (leído del `cause` de un error de dominio) junto al `code` estándar de tRPC.

```ts
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        errorCode: error.cause instanceof AppError ? error.cause.code : undefined,
      },
    };
  },
});
```

**Frontend**: hook que devuelve un `onError` reutilizable. Traduce por `errorCode` (dominio) y cae al `code` de tRPC (`UNAUTHORIZED`, `NOT_FOUND`, ...) y a un genérico.

```ts
// lib/error/useApiError.ts
'use client';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { TRPCClientError } from '@trpc/client';
import type { AppRouter } from 'api';

export function useApiError() {
  const { message } = App.useApp();
  const { t } = useTranslation('api');

  return (error: unknown) => {
    let key = 'errors.generic';
    if (error instanceof TRPCClientError) {
      const data = (error as TRPCClientError<AppRouter>).data;
      key = data?.errorCode ? `errors.${data.errorCode}` : `errors.${data?.code ?? 'generic'}`;
    }
    message.error(t(key, t('errors.generic')));
  };
}
```

> **Contrato clave con el backend:** cada `errorCode` que el backend define debe existir como clave en `locales/*/api.json` bajo `errors.<CODE>`. Los `code` estándar de tRPC (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, `INTERNAL_SERVER_ERROR`) también deben tener su clave. Así todo error del servidor se muestra traducido sin lógica ad-hoc.

### 5.3 (Opcional) Bridge Zod → rules de AntD

Para formularios complejos donde duplicar restricciones en `rules` sea frágil, un `validator` que corre el schema de `@repo/schemas`:

```ts
// lib/form/zodRule.ts
import type { Rule } from 'antd/es/form';
import type { ZodTypeAny } from 'zod';
import i18n from '@/lib/i18n/config';

export const zodField = (schema: ZodTypeAny): Rule => ({
  async validator(_, value) {
    const res = schema.safeParse(value);
    if (!res.success) throw new Error(i18n.t(res.error.issues[0]?.message ?? 'api:errors.generic'));
  },
});
```

Se usa por campo (`rules={[zodField(createNoteSchema.shape.title)]}`). Es una **opción**, no el default; el default es `rules` explícitas.

---

## 6. Estado de servidor (TanStack Query + tRPC)

- El `QueryClient` se crea en `TRPCReactProvider` con `staleTime: 60s`, `retry: 1`.
- **Regla:** ninguna data de servidor se guarda en Zustand. El caché es TanStack Query, poblado por tRPC.
- Query keys y su jerarquía las genera tRPC. Invalidación explícita en `onSuccess` de las mutations con `trpc.x.y.queryFilter()`.
- Prefetch en servidor (opcional, RSC): con el helper de servidor de `@trpc/tanstack-react-query` + `HydrationBoundary`. Solo cuando aporte a LCP; por defecto el fetching es en cliente.

---

## 7. Estado de cliente (Zustand)

Stores en `lib/stores/`. Patrón: `create(persist((set) => ({...}), { name, storage, partialize }))` cuando se necesita persistencia.

| Store | Contenido | Persistencia |
| --- | --- | --- |
| `useLocaleStore` (`lib/stores/locale.store`) | idioma actual + `setLocale`. | `localStorage` |
| `useUiStore` *(ej.)* | estado de UI global (sidebar colapsado, etc.). | opcional |

- **La sesión NO va en Zustand.** La maneja Better Auth (`useSession`). No se duplica el usuario/token en un store.
- Fuera de componentes React, se accede con `useXStore.getState()`.

---

## 8. Autenticación y autorización (Better Auth)

### 8.1 Sesión

Cliente en `lib/auth/client.ts`:

```ts
import { createAuthClient } from 'better-auth/react';
import { env } from '@/env';
export const authClient = createAuthClient({ baseURL: env.NEXT_PUBLIC_API_URL });
export const { signIn, signUp, signOut, useSession } = authClient;
```

- **`useSession()`** expone `{ data: session, isPending }`. La sesión vive en cookie httpOnly; no hay token en JS ni refresh manual.
- **Login/registro**: `signIn.email({ email, password })` / `signUp.email({ name, email, password })`. Manejo de error con `res.error` + `message.error` (AntD).
- **Logout**: `signOut()` → limpia cookie. Si hubiera stores de UI con datos por-usuario, resetearlos acá.
- El backend valida la sesión en `createContext` (`auth.api.getSession`) y expone `ctx.session`; `protectedProcedure` rechaza con `UNAUTHORIZED` si no hay sesión.

### 8.2 Autorización por roles/permisos (opt-in)

Better Auth provee RBAC nativo con los plugins **`access`** + **`admin`**. Es el equivalente directo de un catálogo `@repo/guards` compartido: se define **una vez** y se usa en backend y frontend.

**Catálogo compartido** (`packages/schemas/src/access.ts` o un `@repo/auth` dedicado):

```ts
import { createAccessControl } from 'better-auth/plugins/access';

export const statements = {
  note: ['create', 'read', 'update', 'delete'],
} as const;

export const ac = createAccessControl(statements);
export const roles = {
  admin: ac.newRole({ note: ['create', 'read', 'update', 'delete'] }),
  member: ac.newRole({ note: ['read'] }),
};
```

**Backend** (`apps/api/src/lib/auth.ts`):

```ts
import { admin } from 'better-auth/plugins';
import { ac, roles } from '@repo/schemas/access';
export const auth = betterAuth({ /* ... */, plugins: [admin({ ac, roles, defaultRole: 'member' })] });
```
El plugin `admin` agrega el campo `role` a la tabla `user` (soporta múltiples roles como CSV). Para proteger un procedure por permiso, un `guardedProcedure` que llama `auth.api.userHasPermission({ body: { userId, permissions } })` y lanza `FORBIDDEN` si no pasa.

**Frontend** — cliente con el mismo `ac`/`roles`:

```ts
import { adminClient } from 'better-auth/client/plugins';
export const authClient = createAuthClient({ baseURL, plugins: [adminClient({ ac, roles })] });
```

`useCan` deriva el permiso del `role` de la sesión (evaluación **síncrona**, sin ir al servidor):

```ts
// lib/auth/useCan.ts
export function useCan() {
  const { data } = useSession();
  const role = data?.user?.role ?? 'member';
  return (permissions: Parameters<typeof authClient.admin.checkRolePermission>[0]['permissions']) =>
    authClient.admin.checkRolePermission({ role, permissions });
}
```

`<Can>` — renderiza children solo si hay acceso; si no, `fallback`:

```tsx
<Can allowed={{ note: ['create'] }} fallback={null}>
  <Button type="primary" onClick={openCreate}>{t('index.add')}</Button>
</Can>
```

> **Coherencia BE↔FE garantizada:** backend y frontend importan el **mismo** `ac`/`roles`. Cambiar un permiso en el catálogo lo cambia en ambos lados a la vez — igual que el `@repo/guards` de la arquitectura original.

> **Multi-tenant:** si el proyecto lo requiere, se sustituye/combina con el plugin `organization` (roles por organización, invitaciones, `authClient.organization.checkRolePermission`). Fuera del alcance del boilerplate single-tenant base.

---

## 9. Internacionalización (i18n)

- Config en `lib/i18n/config.ts`: `locales: ['es','en']`, `defaultLocale: 'es'`, namespaces `['common', '<feature>', 'api']`, `defaultNS: 'common'`.
- Recursos en `locales/{es,en}/<namespace>.json`, importados y registrados en `resources`.
- En cliente: `const { t } = useTranslation('<feature>')`. **Todo** texto visible usa `t('clave')`.
- El idioma actual se guarda en `useLocaleStore`; cambiarlo llama `i18n.changeLanguage(locale)`.
- **Convenciones de claves:**
  - Validaciones de formulario/schema: `<feature>.validation.<regla>` (referenciadas desde los schemas Zod de `@repo/schemas` y/o las `rules`).
  - Errores de API: `errors.<CODE>` en el namespace `api` (mapeo directo con los `errorCode`/`code` de tRPC).
  - UI de una feature: `<feature>.<seccion>.<clave>` (ej. `notes.index.title`).

---

## 10. UI (Ant Design + Tailwind)

- Los componentes vienen de **`antd`** (Button, Input, Form, Table, Modal, Select, Card, Flex, Typography, ...) y se importan por nombre. No hay paquete `@repo/ui`.
- El sistema de tokens (marca MB, `machBarTheme`), la relación AntD↔Tailwind, tipografía, layout, formularios y mensajes están definidos en **`styling-guide.md`** — es de lectura obligatoria y manda sobre cualquier decisión visual.
- Reglas rápidas heredadas de esa guía: AntD para componentes y layout, Tailwind para overrides y lo que AntD no cubre; nada de CSS modules, inline styles, ni hex hardcodeados; mensajes vía `App.useApp()` (no métodos estáticos).
- **Tablas: `Table` de AntD, siempre.** Es la convención única — ya integra sort/filter/paginación/selección/expandable/fixed/virtual con el tema (`machBarTheme`). No se usa `@tanstack/react-table` (headless): se pisa con AntD `Table` y no está instalada. Si algún día aparece un caso que AntD no cubre (resizing/pinning fino, faceted filtering, virtualización pesada), se resuelve **headless en un `components/shared/DataTable` aislado** con markup propio + tokens — nunca mezclando `flexRender` dentro del `<Table>` de AntD.
- Componentes **globales de la app** (no primitivas): `PageHeader`, `AppShell`, etc. viven en `components/shared/` y `components/layout/`. Si un patrón se repite en 2+ features, se extrae a `components/shared/`.

---

## 11. Convenciones de nombres

| Elemento | Convención | Ejemplo |
| --- | --- | --- |
| Feature dir | plural del dominio | `features/notes/` |
| Schema | `<accion>XSchema` (en `@repo/schemas`) | `createNoteSchema` |
| Input type | `CreateXInput` / `UpdateXInput` (`z.infer`) | `CreateNoteInput` |
| Entity type | `X` (inferido de `RouterOutputs`) | `Note` |
| Query hook | `useXList` / `useX` | `useNotesList` |
| Mutation hook | `useCreateX` / `useUpdateX` / `useDeleteX` | `useCreateNote` |
| Actions hook | `useXActions` | `useNotesActions` |
| Componente Page | `XPage` / `XPageIndex` | `NotesPage` |
| Modal | `CreateXModal` / `EditXModal` | `CreateNoteModal` |
| Store | `useXStore` | `useLocaleStore` |

---

## 12. Receta — Cómo añadir una feature nueva (checklist para IA)

Para un recurso nuevo `widgets`:

1. **Schema compartido**: crear `packages/schemas/src/widgets.ts` con `createWidgetSchema` / `updateWidgetSchema` (mensajes = claves i18n) y exportar `CreateWidgetInput`/`UpdateWidgetInput`. Reexportar en el `index.ts` de `@repo/schemas`.
2. **Backend (módulo)**: `apps/api/src/modules/widgets/` con `widgets.repository.ts` → `widgets.service.ts` → `widgets.router.ts` (usa `protectedProcedure` y los schemas). Registrar el router en `apps/api/src/trpc/router.ts`. Añadir tabla Drizzle en `db/schema/` si aplica.
3. **Types** (`features/widgets/types.ts`): `export type Widget = RouterOutputs['widgets']['list'][number];`
4. **Data hooks** (`features/widgets/hooks/useWidgets.ts`): `useWidgetsList`, `useWidget(id)`, `useCreateWidget`/`useUpdateWidget`/`useDeleteWidget` con invalidación (`queryFilter`) en `onSuccess` y `onError: useApiError()`.
5. **Components**: `WidgetsPage` (orquesta), `WidgetsTable` + `columns`, `CreateWidgetModal`, `EditWidgetModal`, `WidgetForm`. Textos con `useTranslation('widgets')`.
6. **Barrel** (`index.ts`): exportar `WidgetsPage`, hooks públicos, tipos.
7. **Página**: `app/(app)/widgets/page.tsx` → `import { WidgetsPage } from '@/features/widgets'`.
8. **i18n**: añadir `locales/{es,en}/widgets.json` y registrarlo en `lib/i18n/config.ts`; agregar `errors.*` en `api.json` si el backend define nuevos códigos.
9. **Navegación**: añadir el ítem de menú en `components/layout` (`AppSidebar`).
10. **Autorización (si RBAC activo)**: añadir el recurso `widget` a los `statements` del catálogo de access-control; envolver acciones con `<Can allowed={{ widget: ['create'] }}>` y proteger el router con `guardedProcedure`.

Siguiendo estos pasos, la feature será indistinguible de las existentes.

---

## 13. Anti-patrones (qué NO hacer)

- ❌ Llamar a `useTRPC()` o armar `queryOptions()`/`queryFilter()` **dentro de un componente** (siempre a través de un hook de la feature).
- ❌ Escribir DTOs/entidades a mano en vez de inferirlos (`z.infer` para input, `RouterOutputs` para output).
- ❌ Guardar data de servidor —o la sesión/usuario— en Zustand. La data es TanStack Query; la sesión es Better Auth.
- ❌ Leer `error.message` crudo en la UI en vez de `useApiError` (que traduce por `errorCode`/`code`).
- ❌ Duplicar la validación del contrato: la fuente de verdad es el schema de `@repo/schemas` (backend); las `rules` de AntD son solo UX.
- ❌ Hardcodear texto visible en vez de `t('clave')`.
- ❌ Meter lógica pesada (queries/mutations) en la página del App Router; debe ser thin.
- ❌ Importar desde rutas internas de otra feature en vez de su barrel `index.ts`.
- ❌ Chequear permisos con condicionales ad-hoc sobre strings de rol en vez de `<Can>`/`useCan` + el catálogo de access-control.
- ❌ Usar métodos estáticos de AntD (`message.xxx`) o hex hardcodeados / CSS modules / inline styles — ver `styling-guide.md`.
- ❌ Usar `@tanstack/react-table` u otra librería de tablas: la convención única es `Table` de AntD. Solo se recurre a un core headless en un `DataTable` aislado ante un requerimiento puntual que AntD no cubra.
- ❌ Crear un `AuthProvider` que hidrate tokens manualmente: Better Auth maneja la sesión por cookie.
```
