# Especificación de Arquitectura — Frontend (Web)

> **Propósito de este documento**
> Es una *especificación de arquitectura orientada a IA* (Spec-Driven Development). Describe **cómo se construye** el frontend de `mach-portal` y **las reglas estrictas que un agente de IA debe seguir** para añadir o modificar una feature de forma consistente.
>
> Es el **patrón único** para toda feature. Los ejemplos usan un recurso genérico de placeholder: **`X`** para la entidad y los componentes (`XPage`, `XTable`, …), **`<feature>`** para el directorio/namespace/clave de router. Sustituir por el recurso real.
>
> Documentos hermanos:
> - `styling-guide.md` — tokens AntD ↔ Tailwind, tipografía, iconos, fechas, overrides. **Para todo lo visual, esa guía manda.**
> - `docs/backend/architecture.md` — la API (tRPC/Drizzle/módulos). Este doc es **solo front**; asume que los endpoints tRPC ya existen.
>
> El contrato FE↔BE son los schemas Zod de **`@repo/schemas`** y la inferencia de tipos del router (`AppRouter`).

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
| Iconos | **`lucide-react`** (prohibido `@ant-design/icons`) |
| Fechas | **`date-fns`** vía `lib/date` (`useDateFormatter`) |
| i18n | **i18next** + **react-i18next** (namespaces) |
| Monorepo | **Turborepo** + **pnpm workspaces** |

### Principios no negociables

1. **Feature-Sliced.** El código de dominio vive en `src/features/<feature>/`. Cada feature es autónoma y expone su API pública por un barrel `index.ts`. Las páginas del App Router son *thin*: solo importan y renderizan el componente índice de la feature.
2. **Separación estricta de capas dentro de la feature:** `hooks` (datos + acciones) → `components` (UI). Un componente **nunca** llama a `useTRPC()` directamente ni arma `queryOptions()`/`queryFilter()` inline: pasa siempre por un hook de la feature.
3. **Estado de servidor ≠ estado de cliente.** Datos de la API → **tRPC + TanStack Query**. Estado de UI/preferencias → **Zustand**. No se cachea data de servidor en Zustand.
4. **El contrato es Zod (`@repo/schemas`).** El input de toda query/mutation se tipa/valida con un schema Zod compartido. La validación en el `<Form>` de AntD (`rules`) es solo **UX**; el backend es el límite real.
5. **Tipos inferidos, no escritos a mano.** Request desde `@repo/schemas` (`z.infer`); response desde `inferRouterOutputs<AppRouter>`. Sin DTOs manuales.
6. **Errores de API centralizados.** Todo error de tRPC se traduce a i18n por su `errorCode`/`code` con `useApiError`. Nunca `error.message` crudo.
7. **Autorización declarativa.** La visibilidad por permisos se expresa con `<Can>` / `useCan` sobre `@repo/guards`. Nunca condicionales ad-hoc con strings de rol.
8. **Todo texto visible pasa por i18n** (`useTranslation('<feature>')`). Cero strings hardcodeados.
9. **Tablas server-driven vía `DataTable`.** Toda lista usa el componente compartido `DataTable` + `useDataTable` (paginación/orden/búsqueda en server) — nunca un `<Table>` de AntD armado a mano (§4).
10. **Mobile-first.** Se construye desde el móvil hacia arriba (ver `CLAUDE.md` / `styling-guide.md`). Las tablas rinden **card** en móvil.

---

## 2. Estructura de directorios

```
apps/web/src/
├── app/                        # App Router. Páginas THIN + layouts.
│   ├── layout.tsx              # Root layout (fuentes, AntdRegistry, <AppProviders>)
│   ├── (auth)/                 # Grupo de rutas públicas (login)
│   └── admin/                  # Panel protegido (segmento)
│       ├── layout.tsx          # <AdminLayoutContainer> (shell). El guard de sesión es global (AuthProvider)
│       ├── page.tsx            # Dashboard
│       └── <feature>/page.tsx  # Página THIN: renderiza el índice de la feature
│
├── features/                   # DOMINIO. Un directorio por feature.
│   └── <feature>/
│       ├── components/         # XPage, XTable, columns.tsx, XCard, Create/EditXModal, XForm
│       ├── hooks/              # useX.ts (data hooks) + useXRowActions.ts (acciones de fila)
│       ├── helpers.ts          # Constantes/utilidades UI de la feature (ej. mapa de colores por estado)
│       ├── types.ts            # Entidad INFERIDA del router (RouterOutputs[...])
│       └── index.ts            # BARREL: API pública de la feature
│
├── lib/                        # Infraestructura transversal (no dominio)
│   ├── trpc/                   # client.ts (useTRPC), provider.tsx, types.ts (RouterInputs/Outputs)
│   ├── auth/                   # client.ts, useCan, <Can>, navigation.ts + route-access.ts (RBAC por ruta)
│   ├── navigation/             # Navegación data-driven (items, icons, config, useNavigation)
│   ├── hooks/                  # useIsDesktop, useDateFormatter, ...
│   ├── date/                   # helpers date-fns (formatDate/…)
│   ├── i18n/                   # config.ts
│   ├── error/                  # useApiError.ts (parser tRPC → i18n)
│   └── stores/                 # Zustand stores (locale, ui, ...)
│
├── components/                 # Componentes GLOBALES (no de una feature)
│   ├── providers/              # AppProviders (composición) + AuthProvider (guard de sesión global)
│   ├── Layouts/                # AdminLayoutContainer (shell del panel)
│   ├── NotificationMenu/       # campana (pieza del Topbar)
│   ├── UserProfile/            # menú de usuario (pieza del Topbar)
│   └── shared/                 # DataTable/, PageHeader, PlaceholderPage, Sidebar/, Topbar/, Logo, ...
│
├── theme/                      # antd.ts (tokens MB + machBarTheme), globals.css
├── locales/{es,en}/            # common.json, admin.json, auth.json, <feature>.json, api.json
├── middleware.ts               # redirect en el borde + RBAC por ruta best-effort (cookieCache)
└── env.ts                      # variables de entorno validadas
```

Los schemas Zod viven en **`packages/schemas/src/<feature>.ts`** (`@repo/schemas`), no en la feature del web.

### Path aliases (tsconfig)

```
@/*   → src/*
```

Se importa `@/features/...`, `@/lib/...`, `@/components/...`, `@/theme/...`. Paquetes del monorepo por nombre: **`api`** (`AppRouter`), **`@repo/schemas`** (Zod + tipos de input), **`@repo/guards`** (RBAC).

---

## 3. Anatomía de una feature

| Capa | Archivo(s) | Responsabilidad | Qué NO hace |
| --- | --- | --- | --- |
| **Contrato (compartido)** | `@repo/schemas/src/<feature>.ts` | Tipos de input (`CreateXInput`, `UpdateXInput`) y de la query de lista (`XListQuery`). Fuente de verdad del contrato. | React, HTTP. |
| **Types** | `types.ts` | Entidad **inferida** del router (`RouterOutputs['<feature>']['list']['items'][number]`). | Declarar formas a mano. |
| **Data hooks** | `hooks/useX.ts` | `useXList(query)`, `useCreateX/useUpdateX/useDeleteX`. Envuelven tRPC + invalidan cache + `useApiError`. | Renderizar UI. |
| **Row actions** | `hooks/useXRowActions.ts` | Devuelve `(row) => RowActionItem[]` (copyId/edit/delete + guards + confirm). Compartido por columnas y card. | Llamar `useTRPC()`. |
| **Helpers** | `helpers.ts` | Constantes UI de la feature (ej. mapa de colores por estado). | Lógica de datos. |
| **Components** | `components/*.tsx` | `XPage` orquesta; `XTable` (usa `DataTable`); `columns.tsx` (`useXColumns`); `XCard` (móvil); `Create/EditXModal`; `XForm`. | `useTRPC()` directo. |
| **Barrel** | `index.ts` | API pública (Page, hooks, tipos). | — |

### 3.1 Contrato (`@repo/schemas`) — lo que el front consume

El front importa de `@repo/schemas` los **tipos de input** y la **query de lista**. La creación de estos schemas es responsabilidad del backend (ver `docs/backend/architecture.md`); acá solo se consumen. Los mensajes de validación son claves i18n.

```ts
import type { CreateXInput, UpdateXInput, XListQuery } from '@repo/schemas';
```

### 3.2 Types inferidos (`types.ts`)

La entidad se **infiere** del router; nunca se escribe a mano. La lista devuelve `Paginated<T>`, por eso se navega hasta `items[number]`.

```ts
// lib/trpc/types.ts
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
```

```ts
// features/<feature>/types.ts
import type { RouterOutputs } from '@/lib/trpc/types';
export type X = RouterOutputs['<feature>']['list']['items'][number];
```

### 3.3 Data hooks (`hooks/useX.ts`)

Toda interacción con tRPC pasa por acá. **La query de lista recibe el `query` paginado** (lo produce `useDataTable`, §4). Invalidación con `queryFilter()` en `onSuccess`.

```ts
// features/<feature>/hooks/useX.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateXInput, UpdateXInput, XListQuery } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useXList(query: XListQuery) {
  const trpc = useTRPC();
  return useQuery(trpc.<feature>.list.queryOptions(query));
}

export function useCreateX() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const mutation = useMutation(
    trpc.<feature>.create.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.<feature>.list.queryFilter()),
      onError,
    }),
  );
  return { createX: (data: CreateXInput) => mutation.mutateAsync(data), isPending: mutation.isPending };
}

export function useUpdateX() {
  /* ...igual; updateX: (id, data: UpdateXInput) => mutateAsync({ id, data }) */
}
export function useDeleteX() {
  /* ...igual; deleteX: (id) => mutateAsync({ id }) */
}
```

Convenciones:
- Nombres: `useXList(query)` (lectura de lista), `useCreateX` / `useUpdateX` / `useDeleteX` (escrituras).
- Query keys e invalidación **siempre** vía el proxy tRPC (`queryOptions`, `queryFilter`). Nunca arrays a mano.
- Error de mutation → `useApiError` en `onError`. `try/catch` local solo para lógica extra (ej. cerrar modal).

### 3.4 Row actions (`hooks/useXRowActions.ts`)

Las acciones de fila se definen **una vez** en un hook y se reusan en las columnas (desktop) y en la card (móvil). Usan los presets de `DataTable` (`copyId`/`edit`/`delete`) con sus `guard` y `confirm`.

```ts
// features/<feature>/hooks/useXRowActions.ts
'use client';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { RESOURCES, ACTIONS } from '@repo/guards';
import type { RowActionItem } from '@/components/shared/DataTable';
import type { X } from '../types';

export function useXRowActions({ onEdit, onDelete }: {
  onEdit: (row: X) => void;
  onDelete: (row: X) => void;
}) {
  const { t } = useTranslation('<feature>');
  const { t: tc } = useTranslation('common');
  const { message } = App.useApp();

  return (row: X): RowActionItem[] => [
    { key: 'copyId', onClick: () => { void navigator.clipboard.writeText(row.id); message.success(tc('table.copied')); } },
    { type: 'divider' },
    { key: 'edit', guard: { [RESOURCES.X]: [ACTIONS.UPDATE] }, onClick: () => onEdit(row) },
    {
      key: 'delete',
      guard: { [RESOURCES.X]: [ACTIONS.DELETE] },
      onClick: () => onDelete(row),
      confirm: { content: t('delete.confirmContent', { name: row.name }) },
    },
  ];
}
```

### 3.5 Formulario (`XForm`)

`Form` nativo de AntD. El tipo genérico es el **input inferido** de `@repo/schemas`. Un mismo form sirve create/edit con un prop `mode` que muestra/oculta campos (los que solo aplican al crear). Las `rules` son **UX** y espejan el schema; sus mensajes son claves i18n.

```tsx
// features/<feature>/components/XForm.tsx
'use client';
import { Button, Form, Input, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CreateXInput } from '@repo/schemas';

export function XForm({ mode, initialValues, onSubmit, isPending }: {
  mode: 'create' | 'edit';
  initialValues?: Partial<CreateXInput>;
  onSubmit: (values: CreateXInput) => Promise<void> | void;
  isPending: boolean;
}) {
  const { t } = useTranslation('<feature>');
  const [form] = Form.useForm<CreateXInput>();

  return (
    <Form form={form} layout="vertical" initialValues={initialValues} onFinish={onSubmit} requiredMark={false}>
      <Form.Item name="name" label={t('form.name')} rules={[{ required: true, message: t('validation.nameRequired') }, { max: 120 }]}>
        <Input placeholder={t('form.namePlaceholder')} />
      </Form.Item>

      {mode === 'create' && (
        <Form.Item name="code" label={t('form.code')} rules={[{ required: true, message: t('validation.codeRequired') }]}>
          <Input placeholder={t('form.codePlaceholder')} />
        </Form.Item>
      )}

      <Form.Item name="status" label={t('form.status')} rules={[{ required: true, message: t('validation.statusRequired') }]}>
        <Select options={/* opciones i18n */ []} placeholder={t('form.statusPlaceholder')} />
      </Form.Item>

      <Form.Item className="mb-0">
        <Button type="primary" htmlType="submit" loading={isPending} block>{t('form.save')}</Button>
      </Form.Item>
    </Form>
  );
}
```

Reglas del form:
- Genérico = input inferido de `@repo/schemas` (`CreateXInput`); es "create-shaped". El edit reusa el mismo form y en su `onSubmit` hace `Pick` de los campos editables hacia `UpdateXInput`.
- El `Form` **no** conoce las mutations: recibe `onSubmit`/`isPending`. La Page/Modal los conecta al hook.
- Los `Modal` (`CreateXModal`/`EditXModal`) envuelven el form, montándolo solo cuando `open` (`{open && <XForm/>}`) y con `key={row.id}` en edit para resetear estado por fila.

### 3.6 Page + barrel

`XPage` (`'use client'`) orquesta: `PageHeader` (con acción gateada por `useCan`), `XTable`, y los modales de create/edit con su estado local.

```tsx
// features/<feature>/components/XPage.tsx
export function XPage() {
  const { t } = useTranslation('<feature>');
  const can = useCan();
  const canCreate = can({ [RESOURCES.X]: [ACTIONS.CREATE] });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<X | null>(null);

  return (
    <div>
      <PageHeader title={t('title')} actionLabel={canCreate ? t('index.add') : undefined} onAction={canCreate ? () => setCreateOpen(true) : undefined} />
      <XTable onEdit={setEditing} />
      <CreateXModal open={isCreateOpen} onClose={() => setCreateOpen(false)} />
      <EditXModal row={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}
```

```ts
// features/<feature>/index.ts
export { XPage } from './components/XPage';
export { useXList, useCreateX, useUpdateX, useDeleteX } from './hooks/useX';
export type { X } from './types';
```

---

## 4. Tablas: `DataTable` + `useDataTable` (obligatorio)

Toda tabla se construye con el componente compartido **`components/shared/DataTable`**. Nunca un `<Table>` de AntD suelto. `DataTable` envuelve el `Table` de AntD y añade: paginación/orden/búsqueda server-side, empty state, y **render card en móvil**.

**`useDataTable`** — maneja el estado de la query (page/pageSize/search/sortBy/sortDir) y expone `query` (para el data hook) y `tableProps` (para el `DataTable`). El `sortBy` por defecto se tipa con el enum del módulo:

```ts
const table = useDataTable<XListQuery['sortBy']>({ defaultSortBy: 'createdAt' });
const { data, isLoading } = useXList(table.query);
```

**`columns.tsx`** — las columnas son un **hook** `useXColumns({ onEdit, onDelete })` (necesita `t`, formatters de fecha, `useXRowActions`). Cada columna decide su visibilidad con `responsive` (ej. `responsive: ['lg']`). La última columna son las acciones (`DataTableRowActions`):

```tsx
// features/<feature>/components/columns.tsx
export function useXColumns({ onEdit, onDelete }): TableColumnsType<X> {
  const { t } = useTranslation('<feature>');
  const { t: tc } = useTranslation('common');
  const { date } = useDateFormatter();
  const rowActions = useXRowActions({ onEdit, onDelete });

  return [
    { title: t('columns.name'), dataIndex: 'name', key: 'name' },
    { title: t('columns.status'), dataIndex: 'status', key: 'status', render: (s) => <Tag color={STATUS_COLORS[s] ?? 'default'}>{t(`status.${s}`, s)}</Tag> },
    { title: t('columns.createdAt'), dataIndex: 'createdAt', key: 'createdAt', responsive: ['md'], render: (v) => date(v) },
    { title: '', key: 'actions', width: 56, align: 'right', render: (_, row) => <DataTableRowActions actions={rowActions(row)} label={tc('table.actions')} /> },
  ];
}
```

**`XCard`** — la vista de cada fila en móvil. Reusa `useXRowActions`. Se pasa a `DataTable` con `mobileRenderType="card"` + `renderCard`:

```tsx
// features/<feature>/components/XCard.tsx  (resumen)
export function XCard({ row, onEdit, onDelete }) {
  const rowActions = useXRowActions({ onEdit, onDelete });
  return (
    <Card size="small">
      {/* header: título de la fila + <DataTableRowActions actions={rowActions(row)} /> */}
      {/* tags: campos secundarios (estado, etc.) */}
      {/* fecha: useDateFormatter().date(row.createdAt) */}
    </Card>
  );
}
```

**`XTable`** — junta todo. Fina: solo hooks + `<DataTable>`:

```tsx
// features/<feature>/components/XTable.tsx
export function XTable({ onEdit }: { onEdit: (row: X) => void }) {
  const { t } = useTranslation('<feature>');
  const { t: tc } = useTranslation('common');
  const table = useDataTable<XListQuery['sortBy']>({ defaultSortBy: 'createdAt' });
  const { data, isLoading } = useXList(table.query);
  const { deleteX } = useDeleteX();

  const onDelete = (row: X) => deleteX(row.id);
  const columns = useXColumns({ onEdit, onDelete });

  return (
    <DataTable<X>
      {...table.tableProps}
      rowKey="id"
      columns={columns}
      mobileRenderType="card"
      renderCard={(row) => <XCard row={row} onEdit={onEdit} onDelete={onDelete} />}
      dataSource={data?.items}
      loading={isLoading}
      total={data?.pagination.total}
      searchPlaceholder={tc('table.search')}
      emptyText={t('empty')}
    />
  );
}
```

Notas:
- **Server mode se activa** al pasar `total` (viene de `data.pagination.total`). `page`/`pageSize`/`sortBy`/`sortDir`/`onTableChange`/`onSearch` salen de `table.tableProps`.
- **`renderCard` es el estándar** para una card a medida. Si se omite (con `mobileRenderType="card"`), `DataTable` cae a `AutoRowCard` (deriva label/valor de las columnas) — aceptable solo para tablas triviales.
- `DataTableRowActions` recibe `RowActionItem[]`; filtra por `guard` con `useCan` y aplica `confirm` con `modal.confirm`. Presets (`copyId`/`edit`/`delete`) traen icono (lucide), label i18n y confirm por defecto.

---

## 5. App Router: páginas thin + layouts + providers

- **Página** = adaptador de ruta. Solo renderiza el índice de la feature:
  ```tsx
  // app/admin/<feature>/page.tsx
  import { XPage } from '@/features/<feature>';
  export default function Page() { return <XPage />; }
  ```
- **Rutas**: `(auth)` (route group) para páginas públicas (login); `admin/` (segmento) para el panel protegido.
- **Layouts**: `app/layout.tsx` → fuentes + `AntdRegistry layer` + `<AppProviders>`. `app/admin/layout.tsx` → solo `<AdminLayoutContainer>` (shell responsive: Sider colapsable / Drawer móvil, en `components/Layouts` + `lib/navigation`). El guard de sesión **no** vive en este layout: es global (`AuthProvider`, ver abajo).

### Providers (`components/providers/AppProviders.tsx`)

Orden **exacto** (de fuera hacia dentro):

```
ConfigProvider (AntD theme = machBarTheme)
└── App (AntD)                       # contexto para message/notification/modal (App.useApp)
    └── I18nextProvider
        └── TRPCReactProvider         # QueryClient + tRPC client (credentials: 'include')
            └── AuthProvider           # guard de sesión global (client), en components/providers
                └── {children}
```

- El `App` de AntD envuelve todo lo que use `App.useApp()` (mensajes/errores). Por eso va por fuera de tRPC.
- El `httpBatchLink` de tRPC usa `fetch(..., { credentials: 'include' })` para mandar la cookie de sesión.
- El `AuthProvider` va por dentro de tRPC/i18n (usa `useSession()` y traduce). **No hidrata tokens** — solo guarda rutas.

### Protección de rutas

Tres capas complementarias; la autorización **real** siempre la hace la API:

1. **Middleware** (`middleware.ts`, borde): sin sesión + ruta protegida → redirige a `/login` (con `callbackUrl`); con sesión en ruta de auth → redirige a home. Además hace **RBAC por ruta best-effort**: resuelve el permiso requerido con `resolveRouteAccess` (`lib/auth/route-access.ts`) y, si el rol cacheado (`getCookieCache`) no lo cumple, reescribe a bienvenida/denegado. Con caché fría, cae a la API.
2. **`AuthProvider`** (`components/providers/`, cliente): en rutas protegidas (`isProtectedRoute`) usa `useSession()`; muestra loader mientras resuelve, un estado de error si el server falla, y redirige a `/login` si no hay sesión.
3. **API** (backend): `protectedProcedure` / `guardedProcedure` — el único límite de autorización confiable.

Rutas y permisos viven en `lib/auth/navigation.ts` (`PROTECTED_ROUTES`/`AUTH_ROUTES`/redirects) y `lib/auth/route-access.ts` (`ROUTE_ACCESS`: prefijo → `PermissionCheck`).

---

## 6. Datos y errores (tRPC en el front)

### 6.1 Cliente (`lib/trpc/`)

```ts
// lib/trpc/client.ts
'use client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import type { AppRouter } from 'api';
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
```

El `httpBatchLink` usa `fetch(..., { credentials: 'include' })` para mandar la cookie de sesión. `QueryClient` con `staleTime: 60_000`, `retry: 1`.

### 6.2 Errores centralizados (`lib/error/useApiError.ts`)

El backend expone un `errorCode` estable (ver `docs/backend/architecture.md`); el front lo traduce contra el namespace `api`.

```ts
// lib/error/useApiError.ts
'use client';
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

> **Contrato:** cada `errorCode` del backend debe existir como clave en `locales/*/api.json` bajo `errors.<CODE>`; los `code` estándar de tRPC (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, `CONFLICT`, `INTERNAL_SERVER_ERROR`) también.

### 6.3 (Opcional) Bridge Zod → rules de AntD

Para formularios complejos, un `validator` que corre el schema de `@repo/schemas` por campo (`lib/form/zodRule.ts`). Es opción, no default; el default es `rules` explícitas.

---

## 7. Estado de servidor (TanStack Query)

- `QueryClient` en `TRPCReactProvider` (`staleTime: 60s`, `retry: 1`).
- **Ninguna** data de servidor en Zustand. El caché es TanStack Query, poblado por tRPC.
- Query keys y su jerarquía las genera tRPC. Invalidación explícita en `onSuccess` con `trpc.x.y.queryFilter()`.

---

## 8. Estado de cliente (Zustand)

Stores en `lib/stores/`. `create(persist((set) => ({...}), { name }))` cuando se persiste.

| Store | Contenido | Persistencia |
| --- | --- | --- |
| `useLocaleStore` | idioma actual + `setLocale`. | `localStorage` |
| `useUiStore` *(ej.)* | UI global (sidebar colapsado, etc.). | opcional |

- **La sesión NO va en Zustand** — la maneja Better Auth (`useSession`).

---

## 9. Autenticación y autorización (front)

### 9.1 Sesión (`lib/auth/client.ts`)

```ts
import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';
import { ac, roles } from '@repo/guards';
export const authClient = createAuthClient({ baseURL, plugins: [adminClient({ ac, roles })] });
export const { signIn, signUp, signOut, useSession } = authClient;
```

- `useSession()` → `{ data, isPending }`. Sesión en cookie httpOnly; sin token en JS.
- Login: `signIn.email(...)`; logout: `signOut()`.

### 9.2 Autorización (`useCan` / `<Can>`)

El catálogo de roles/permisos es único en **`@repo/guards`** y se comparte con el backend (que lo aplica con `guardedProcedure` — ver `docs/backend/architecture.md`). En el front se evalúa **síncrono** (sin ir al server):

```ts
// lib/auth/useCan.ts
export function useCan() {
  const { data } = useSession();
  const role = (data?.user as { role?: string | null })?.role ?? DEFAULT_ROLE;
  return (permissions: PermissionCheck) => hasPermission(role, permissions);
}
```

```tsx
<Can allowed={{ [RESOURCES.X]: [ACTIONS.CREATE] }} fallback={null}>
  <Button type="primary" onClick={openCreate}>{t('index.add')}</Button>
</Can>
```

> **Regla — nunca strings sueltos en un `PermissionCheck`.** Recursos y acciones de **dominio** usan las constantes tipadas de `@repo/guards` (`RESOURCES`, `ACTIONS`): `{ [RESOURCES.X]: [ACTIONS.READ] }`, nunca `{ x: ['read'] }`. Aplica en `<Can>`, `useCan()(...)` y los `guard` de navegación.
>
> **Excepción:** los statements nativos de Better Auth (los que no son recursos de dominio) no tienen constante en `RESOURCES` — se referencian por su literal. Solo los recursos de dominio pasan por `RESOURCES`/`ACTIONS`.

---

## 10. Internacionalización (i18n)

- Config en `lib/i18n/config.ts`: `locales: ['es','en']`, `defaultLocale: 'es'`, namespaces `['common', 'admin', 'auth', '<feature>', 'api']`, `defaultNS: 'common'`. Registrar el nuevo `<feature>` acá.
- Recursos en `locales/{es,en}/<namespace>.json`.
- **Todo** texto visible usa `t('clave')` con `useTranslation('<feature>')`.
- Namespaces transversales: **`common`** (acciones y tabla: `save`, `cancel`, `edit`, `delete`, `yes`/`no`, `table.actions/copyId/copied/search/total`, `confirm.*`); **`admin`** (shell/navegación); **`auth`** (login + estados de sesión del `AuthProvider`); **`api`** (errores).
- Fechas: **nunca** `toLocaleDateString`; usar `useDateFormatter()` (date-fns, locale-aware).
- **Convenciones de claves:** validación `<feature>.validation.<regla>`; UI `<feature>.<seccion>.<clave>` (ej. `<feature>.columns.name`, `<feature>.index.add`); errores `errors.<CODE>` en `api`.

---

## 11. UI (Ant Design + Tailwind)

- Componentes desde **`antd`**, importados por nombre. No hay `@repo/ui`.
- Tokens (marca MB, `machBarTheme`), AntD↔Tailwind, tipografía, **iconos (`lucide-react`)**, **fechas (`date-fns`)** y la **escala de overrides** están en **`styling-guide.md`** — lectura obligatoria y manda sobre cualquier decisión visual.
- Reglas rápidas: AntD para componentes/layout, Tailwind para overrides; nada de CSS modules, inline styles, ni hex hardcodeados; mensajes vía `App.useApp()` (no métodos estáticos); `!` de Tailwind como **sufijo** (`m-0!`).
- **Tablas → siempre `DataTable`** (§4). Prohibido `<Table>` de AntD armado a mano en una feature y prohibido `@tanstack/react-table`.
- **Componentes globales:** el shell (`AdminLayoutContainer`) en `components/Layouts/`; los providers en `components/providers/`; piezas propias del shell con carpeta propia (`NotificationMenu/`, `UserProfile/`); primitivas y reutilizables (`DataTable/`, `PageHeader`, `PlaceholderPage`, `Sidebar/`, `Topbar/`, `Logo`, …) en `components/shared/`. Un patrón repetido en 2+ features → se extrae a `components/shared/`.
- **Navegación data-driven** (`lib/navigation/`): `constants/items.ts` (`NAV_ITEMS` con `label`/`href`/`icon`/`guard`), `constants/icons.tsx` (`IconMap` string→icono lucide), `config.ts` (`ADMIN_MENU`), `useNavigation()`. `SidebarNav` la renderiza y filtra por permisos.
- **Shell responsive (mobile-first):** `AdminLayoutContainer` usa `useIsDesktop()` (lg=992px): desktop = `Sider` colapsable a rail de iconos; móvil = `Drawer` overlay con el mismo `SidebarContent`.

---

## 12. Convenciones de nombres

`X` = nombre del recurso en singular PascalCase; `<feature>` = plural kebab/camel para dir y namespace.

| Elemento | Patrón |
| --- | --- |
| Feature dir | `features/<feature>/` (plural del dominio) |
| Input type (de `@repo/schemas`) | `CreateXInput` / `UpdateXInput` |
| Query de lista | `XListQuery` |
| Entity type (de `RouterOutputs`) | `X` |
| Query hook | `useXList(query)` |
| Mutation hooks | `useCreateX` / `useUpdateX` / `useDeleteX` |
| Row actions hook | `useXRowActions` |
| Columns hook | `useXColumns` |
| Componente Page | `XPage` |
| Tabla / Card | `XTable` / `XCard` |
| Modales | `CreateXModal` / `EditXModal` |
| Store | `useXStore` |

---

## 13. Receta — Añadir una feature nueva (checklist estricto)

> **Precondición:** los endpoints tRPC ya existen — `<feature>.list` (paginado, devuelve `{ items, pagination }`), `<feature>.create`, `<feature>.update`, `<feature>.delete` — y el schema `@repo/schemas/src/<feature>.ts` (`createXSchema`/`updateXSchema`/`xListQuerySchema`) está publicado. Si no, ver `docs/backend/architecture.md`.

1. **Types** (`features/<feature>/types.ts`): `export type X = RouterOutputs['<feature>']['list']['items'][number];`
2. **Data hooks** (`hooks/useX.ts`): `useXList(query)`, `useCreateX`/`useUpdateX`/`useDeleteX` con `queryFilter()` en `onSuccess` y `onError: useApiError()`.
3. **Row actions** (`hooks/useXRowActions.ts`): `(row) => RowActionItem[]` con `copyId`/`edit`(guard update)/`delete`(guard delete + confirm).
4. **Helpers** (`helpers.ts`): constantes UI si aplica (ej. colores de estado).
5. **Columnas** (`components/columns.tsx`): `useXColumns({ onEdit, onDelete })` → `TableColumnsType<X>`; fechas con `useDateFormatter`; columna de acciones con `DataTableRowActions`; `responsive` por columna.
6. **Card** (`components/XCard.tsx`): card móvil que reusa `useXRowActions`.
7. **Tabla** (`components/XTable.tsx`): `useDataTable` + `useXList(query)` + `<DataTable mobileRenderType="card" renderCard={...} total={data?.pagination.total} .../>`.
8. **Form + Modales** (`XForm`, `CreateXModal`, `EditXModal`): form con `mode`, modales que lo montan bajo `open`.
9. **Page** (`XPage`): `PageHeader` (acción gateada con `useCan`) + tabla + modales.
10. **Barrel** (`index.ts`): exportar `XPage`, hooks públicos, `X`.
11. **Página** (`app/admin/<feature>/page.tsx`): `import { XPage } from '@/features/<feature>'`.
12. **i18n**: `locales/{es,en}/<feature>.json` (title, index.add, columns.*, form.*, validation.*, delete.*, empty) + registrar el namespace en `lib/i18n/config.ts`. Nav labels en `admin` (`nav.*`).
13. **Navegación**: ítem en `lib/navigation/constants/items.ts` (+ `guard` con `RESOURCES`/`ACTIONS`), grupo en `config.ts`, icono lucide en `constants/icons.tsx`.
14. **Acceso a la ruta**: registrar el permiso en `lib/auth/route-access.ts` (`ROUTE_ACCESS`: `/admin/<feature>` → `{ [RESOURCES.X]: [ACTIONS.READ] }`, o `null` si es pública para logueados). Habilita el RBAC por ruta del middleware.
15. **Autorización de acciones**: envolver create/edit/delete con `<Can>` / gatear con `useCan` usando `RESOURCES`/`ACTIONS`.

Siguiendo estos pasos, la feature será **consistente con el patrón** y con el resto del panel.

---

## 14. Anti-patrones (qué NO hacer)

- ❌ Armar un `<Table>` de AntD a mano en una feature: la convención única es `DataTable` (§4). Prohibido `@tanstack/react-table`.
- ❌ Renderizar la tabla sin card en móvil (falta `mobileRenderType="card"` + `renderCard`).
- ❌ Duplicar las row actions en columnas y card: extraer `useXRowActions` y reusarlo.
- ❌ Llamar a `useTRPC()` o armar `queryOptions()`/`queryFilter()` dentro de un componente (siempre vía hook de la feature).
- ❌ Escribir DTOs/entidades a mano en vez de inferirlos (`z.infer` input, `RouterOutputs` output). Recordar que la lista es `['list']['items'][number]`.
- ❌ Guardar data de servidor —o la sesión/usuario— en Zustand.
- ❌ Leer `error.message` crudo en la UI en vez de `useApiError`.
- ❌ Duplicar la validación del contrato: la fuente de verdad es `@repo/schemas`; las `rules` de AntD son solo UX.
- ❌ Hardcodear texto visible en vez de `t('clave')`, o formatear fechas sin `useDateFormatter`.
- ❌ Meter lógica pesada (queries/mutations) en la página del App Router; debe ser thin.
- ❌ Importar desde rutas internas de otra feature en vez de su barrel `index.ts`.
- ❌ Chequear permisos con condicionales ad-hoc sobre strings de rol en vez de `<Can>`/`useCan` + `@repo/guards` (con `RESOURCES`/`ACTIONS`).
- ❌ Usar `@ant-design/icons` (la librería es `lucide-react`), métodos estáticos de AntD (`message.xxx`), hex hardcodeados, CSS modules o inline styles — ver `styling-guide.md`.
- ❌ Hidratar o duplicar la sesión/token en estado propio: Better Auth la maneja por cookie (`useSession`). El `AuthProvider` del proyecto solo **guarda rutas** con `useSession`; no hidrata nada.
- ❌ Volver a poner el guard de sesión en `app/admin/layout.tsx`: el guard es global (`AuthProvider`) y el acceso por ruta lo maneja el middleware + `route-access.ts`.
```
