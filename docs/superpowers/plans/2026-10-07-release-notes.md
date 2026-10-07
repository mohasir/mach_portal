# Novedades por release — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modal de novedades en carrusel que cada usuario ve una sola vez por deploy con novedades, con el "visto" guardado en `user_preferences`.

**Architecture:** El contenido vive en la web, un archivo tipado por versión registrado en un mapa. Una función pura decide `show` / `markSeen` / `none` a partir de la versión actual (`env.NEXT_PUBLIC_APP_VERSION`), la última vista (`userPreferences.lastSeenReleaseNotes`) y si hay archivo. Un `<ReleaseNotesGate />` en el shell del panel aplica la decisión y monta el modal.

**Tech Stack:** Next.js 15 · React 19 · AntD v6 (`WrapperModal`, `Carousel`) · Tailwind v4 · i18next · tRPC + TanStack Query · Zod 4 · Vitest · `react-icons/tb` / `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-10-07-release-notes-design.md`

## Global Constraints

- Rama `feat/release-notes` (desde `dev`); PR hacia `dev`; **no pasa a `staging`**.
- **Git:** sin commits por tarea. Todo queda sin commitear y se pide OK explícito antes de commit / push / PR (`CLAUDE.md`).
- No levantar servidores ni browser; verificación con `pnpm test` y `pnpm check-types` (deben pasar sin errores al final de cada tarea).
- Comentarios en inglés y solo para el *por qué*.
- Web: mobile-first; sin inline styles, CSS modules, hex ni `uppercase`; todo texto por i18n es/en; patrón de `docs/frontend/architecture.md` (hooks en la feature, componentes sin `useTRPC`).
- La versión actual se lee de `env.NEXT_PUBLIC_APP_VERSION` (`@/env`); ya existe, no tocar `next.config.ts`.
- Sin cambios en la API ni migraciones: solo una clave nueva en `@repo/schemas`.

## Review Focus

1. **Preferencias que no cargan** (API caída o error en `userPreferences.get`): el gate no muestra nada y la app sigue usable. → Task 4, `resolveGateState` con `preferences: undefined`.
2. **Versión con formato inesperado** (`"0.17"`, `"dev"`, vacío) en `NEXT_PUBLIC_APP_VERSION` o en `lastSeen`: no tiene que tirar error ni mostrar el modal. → Task 2, casos de `compareVersions` / `resolveReleaseNotesAction`.
3. **Cambio de cuenta en la misma pestaña:** el cache de `userPreferences.get` no es por usuario (`useSyncUserPreferences` lo resetea). El gate no debe decidir con las preferencias de la cuenta anterior. → Task 4: el gate decide solo con `isFetchedAfterMount` y la query reseteada; verificación manual.
4. **Doble disparo de `markSeen`** (re-render o StrictMode): la escritura silenciosa se hace una vez por versión y por usuario. → Task 4, guard con ref `${userId}:${version}`.
5. **Release con una sola diapositiva o sin imágenes:** sin puntos, sin "Atrás", sin hueco de imagen. → Task 3 (validación del registro) + verificación manual.

---

### Task 1: Clave `lastSeenReleaseNotes` en las preferencias

**Files:**
- Modify: `packages/schemas/src/userPreferences.ts`
- Test: `apps/api/src/modules/userPreferences/userPreferences.schema.test.ts` (nuevo; `packages/schemas` no tiene runner)

**Interfaces:**
- Produces: `UserPreferences.lastSeenReleaseNotes?: string`; `UpdateUserPreferencesInput.lastSeenReleaseNotes?: string`.

- [ ] **Step 1: Tests que fallan**
  - `userPreferencesSchema.parse({ timeFormat: '24h' }).lastSeenReleaseNotes` → `undefined`.
  - `userPreferencesSchema.parse({ lastSeenReleaseNotes: '0.17.0' }).lastSeenReleaseNotes` → `'0.17.0'`.
  - `userPreferencesSchema.parse({ lastSeenReleaseNotes: 42, timeFormat: '24h' })` → `lastSeenReleaseNotes` `undefined` **y** `timeFormat` `'24h'` (una clave inválida no rompe las demás).
  - `updateUserPreferencesSchema.parse({ lastSeenReleaseNotes: '0.17.0' })` → `{ lastSeenReleaseNotes: '0.17.0' }`.
- [ ] **Step 2:** `pnpm --filter api test userPreferences` → FAIL.
- [ ] **Step 3:** Agregar `lastSeenReleaseNotes: z.string().optional().catch(undefined)` al schema de lectura (con un JSDoc corto como las demás claves) y `lastSeenReleaseNotes: z.string()` al objeto del `.partial()`.
- [ ] **Step 4:** `pnpm --filter api test userPreferences` → PASS; `pnpm check-types` sin errores.

---

### Task 2: Decisión y comparación de versiones

**Files:**
- Create: `apps/web/src/features/release-notes/types.ts`, `apps/web/src/features/release-notes/helpers.ts`
- Test: `apps/web/src/features/release-notes/helpers.test.ts`

**Interfaces:**
- Produces (`types.ts`): `LocalizedText`, `ReleaseNoteSlide`, `ReleaseNote` exactamente como spec §3.2; `ReleaseNotesAction = 'show' | 'markSeen' | 'none'`.
- Produces (`helpers.ts`):
  - `compareVersions(a: string, b: string): number | null` — negativo / 0 / positivo; `null` si alguna no es `MAJOR.MINOR.PATCH` numérico.
  - `resolveReleaseNotesAction(input: { currentVersion: string; lastSeen: string | undefined; hasNotes: boolean }): ReleaseNotesAction`.

- [ ] **Step 1: Tests que fallan**
  - `compareVersions`: `('0.10.0','0.9.0') > 0`; `('0.17.0','0.17.0') === 0`; `('0.16.0','0.17.0') < 0`; `('1.0.0','0.99.99') > 0`; `('0.17','0.17.0')`, `('dev','0.17.0')`, `('','0.17.0')` → `null`.
  - `resolveReleaseNotesAction` (spec §4.2):
    - `lastSeen: undefined, hasNotes: true` → `'markSeen'`; también con `hasNotes: false` → `'markSeen'`.
    - `lastSeen === currentVersion` → `'none'`.
    - current `0.17.0`, lastSeen `0.16.0`, `hasNotes: true` → `'show'`; `hasNotes: false` → `'none'`.
    - current `0.16.0`, lastSeen `0.17.0` (rollback), `hasNotes: true` → `'none'`.
    - Versión inválida en cualquiera de los dos lados (`compareVersions` → `null`) con `lastSeen` definido → `'none'`.
- [ ] **Step 2:** `pnpm --filter web test release-notes` → FAIL.
- [ ] **Step 3:** Implementar ambos en `helpers.ts`.
- [ ] **Step 4:** `pnpm --filter web test release-notes` → PASS.

---

### Task 3: Registro de contenido y su validación

**Files:**
- Create: `apps/web/src/features/release-notes/content/index.ts`
- Modify: `apps/web/src/features/release-notes/helpers.ts`
- Test: `apps/web/src/features/release-notes/content/content.test.ts`

**Interfaces:**
- Consumes: `ReleaseNote` (Task 2).
- Produces: `RELEASE_NOTES: Record<string, ReleaseNote>` (arranca **vacío**: el primer deploy de la feature no muestra nada, spec §4.2); `getReleaseNote(version: string): ReleaseNote | undefined`; `validateReleaseNotes(registry: Record<string, ReleaseNote>): string[]` (lista de errores legibles, vacía si todo está bien).

- [ ] **Step 1: Tests que fallan**
  - `validateReleaseNotes(RELEASE_NOTES)` → `[]` (el registro real siempre válido).
  - Con fixtures: clave `'0.17.0'` con `version: '0.18.0'` → 1 error; release con `slides: []` → 1 error; imagen con `src: '/release-notes/0.16.0/a.png'` bajo la clave `'0.17.0'` → 1 error; release válido con y sin imagen → `[]`.
  - `getReleaseNote('0.99.0')` → `undefined`.
- [ ] **Step 2:** `pnpm --filter web test release-notes` → FAIL.
- [ ] **Step 3:** Implementar `content/index.ts` (mapa vacío + `getReleaseNote`) y `validateReleaseNotes` en `helpers.ts`. Regla de imagen: `src.startsWith(\`/release-notes/${version}/\`)`.
- [ ] **Step 4:** `pnpm --filter web test release-notes` → PASS.

---

### Task 4: Hooks, gate y modal

**Files:**
- Create: `apps/web/src/features/release-notes/hooks/useReleaseNotes.ts`
- Create: `apps/web/src/features/release-notes/components/ReleaseNotesGate.tsx`, `ReleaseNotesModal.tsx`
- Create: `apps/web/src/features/release-notes/index.ts`
- Create: `apps/web/src/locales/{es,en}/releaseNotes.json`
- Modify: `apps/web/src/lib/i18n/config.ts` (registrar namespace `releaseNotes`)
- Modify: `apps/web/src/components/Layouts/AdminLayoutContainer.tsx` (montar el gate una vez, fuera del switch desktop/móvil)
- Modify: `apps/web/src/features/release-notes/helpers.ts` + `helpers.test.ts`

**Interfaces:**
- Consumes: `useUserPreferences` (`@/features/settings`), `useSession` (`@/lib/auth/client`), `env` (`@/env`), Tasks 1–3.
- Produces:
  - `resolveGateState(input: { currentVersion: string; preferences: { lastSeenReleaseNotes?: string } | undefined; note: ReleaseNote | undefined }): { action: ReleaseNotesAction; note?: ReleaseNote }` en `helpers.ts` — `preferences` `undefined` (cargando o error) → `{ action: 'none' }`; si no, delega en `resolveReleaseNotesAction` y adjunta `note` solo con `'show'`.
  - `useMarkReleaseNotesSeen(): (version: string) => void` — `trpc.userPreferences.update.mutationOptions` con `onSuccess: setQueryData(userPreferences.get)` y **sin `onError`** (falla en silencio, spec §4.3).
  - `ReleaseNotesModal({ note, locale, onDone }: { note: ReleaseNote; locale: AppLocale; onDone: () => void })`.

- [ ] **Step 1: Tests que fallan** (`resolveGateState`): `preferences: undefined` → `{ action: 'none' }`; `preferences: {}` → `'markSeen'` sin `note`; `{ lastSeenReleaseNotes: '0.16.0' }` + note `0.17.0` + current `0.17.0` → `{ action: 'show', note }`; mismo caso sin note → `'none'`.
- [ ] **Step 2:** `pnpm --filter web test release-notes` → FAIL. **Step 3:** implementar `resolveGateState`. **Step 4:** PASS.
- [ ] **Step 5: `ReleaseNotesGate`** — `useSession()` → `userId`; `useUserPreferences(!!userId)`; decide con `resolveGateState` solo cuando la query tiene `isFetchedAfterMount` (Review Focus 3). `'markSeen'` → llama `markSeen(currentVersion)` una vez, guardado en un ref con clave `${userId}:${currentVersion}` (Review Focus 4). `'show'` → estado local `open`; `onDone` cierra al instante y llama `markSeen`. Locale actual desde `useLocaleStore`.
- [ ] **Step 6: `ReleaseNotesModal`** según spec §5:
  - `WrapperModal` con `width={{ xs: '90%', md: 480 }}`, `closable={false}`, `maskClosable` y `keyboard` que llaman `onDone`.
  - Encabezado propio: "Novedades" + `Tag` `v{version}` a la izquierda; botón de texto "Saltar" a la derecha en toda diapositiva salvo la última.
  - `Carousel` de AntD con `ref` (`next()` / `prev()` / `afterChange` para el índice), `dots` solo con más de una diapositiva.
  - Diapositiva: imagen opcional (`next/image` con `fill` dentro de un contenedor `aspect-[16/10]`, `object-contain`, fondo neutro, `rounded-xl`), título `text-lg font-semibold` centrado, descripción centrada en gris, bloque de texto con alto mínimo (`min-h-24`).
  - Botones `flex gap-2`, cada uno `flex-1`: "Atrás" (default, `disabled` en la primera) y "Siguiente" (primary) → "Continuar" en la última. Una sola diapositiva: solo "Continuar".
  - Textos de diapositiva: `text[locale]`.
- [ ] **Step 7:** i18n `releaseNotes.json` (es/en): `title` (Novedades / What's new), `version` (`v{{version}}`), `skip` (Saltar / Skip), `back` (Atrás / Back), `next` (Siguiente / Next), `continue` (Continuar / Continue). Registrar el namespace en `lib/i18n/config.ts`.
- [ ] **Step 8:** Montar `<ReleaseNotesGate />` en `AdminLayoutContainer` (una vez, junto al layout elegido) y exportar `ReleaseNotesGate` desde `index.ts`.
- [ ] **Step 9:** `pnpm --filter web test` y `pnpm check-types` → todo verde. Verificación manual (usuario): con un archivo temporal de novedades para la versión actual y `lastSeenReleaseNotes` anterior, revisar spec §6 "Manual".

---

### Task 5: Documentación

**Files:**
- Modify: `docs/frontend/architecture.md` (sección corta "Novedades por release", después de §3.7)
- Modify: `docs/superpowers/specs/2026-10-07-release-notes-design.md` (estado → implementado; §3.1 aclara que `NEXT_PUBLIC_APP_VERSION` ya existía; §4.3 mutación propia sin toast)

- [ ] **Step 1:** Documentar el flujo de spec §7 (versión → archivo `content/<versión>.ts` → registro en `content/index.ts` → imágenes opcionales en `public/release-notes/<versión>/`) y que `pnpm test` valida el registro.
- [ ] **Step 2:** Actualizar la spec.
- [ ] **Step 3:** `pnpm test` + `pnpm check-types` finales → verde. Mostrar el diff al usuario y pedir OK para commit, push y PR hacia `dev`.
