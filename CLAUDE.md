# CLAUDE.md — Mach Portal

Monorepo Turborepo + pnpm.
- `apps/web` — Next.js 15 · React 19 · **AntD v6 · Tailwind v4** · i18next (es/en)
- `apps/api` — Express 5 · tRPC v11 · Drizzle · Better Auth
- `packages/*` — código compartido (`@repo/guards` RBAC, `@repo/schemas` Zod, config)

---

## Convenciones de código (todo el monorepo)

- **Comentarios → siempre en inglés.** Escribir un comentario **solo** cuando aporta algo
  que el código no dice por sí mismo: explicar *por qué* (una decisión no obvia, un workaround,
  una restricción) o el *propósito* de un bloque no evidente. **Prohibido**: comentarios que
  narran lo que el código ya expresa, y comentarios que mencionan decisiones habladas en el chat
  o cualquier contexto de la sesión (ej. "como pediste", "según lo acordado", "TODO de la charla").
  El comentario debe tener sentido para quien lea el repo sin haber estado en la conversación.

---

## Frontend / Web (`apps/web`) — REGLAS OBLIGATORIAS

> Aplican a **todo** trabajo de front, UI o componentes de la web app.

- **Mobile-first, siempre.** Diseñar y construir desde el móvil hacia arriba: estilos base
  para viewport chico y escalar con breakpoints (`sm: md: lg: xl:` de Tailwind, `xs md lg`
  de AntD `Grid`/`Row`/`Col`). **Nunca** partir de desktop y parchear móvil después.
  Toda vista nueva o modificada debe verse y funcionar bien en móvil antes de darse por hecha.

- **Estilos → seguir `docs/frontend/styling-guide.md`.** Es la fuente de verdad de estilos:
  AntD v6 para componentes/layout y Tailwind para overrides; tokens de marca en
  `apps/web/src/theme/antd.ts` (objeto `MB` + `machBarTheme`). Prohibido: CSS modules,
  inline styles y colores hex hardcodeados en componentes.

- **Sobreescribir estilos de AntD → escala de overrides** de `docs/frontend/styling-guide.md`
  (sección "Overrides de estilos AntD"). Ante un componente AntD que se ve mal (ej. icono
  descentrado), usar **siempre el primer nivel que resuelva**: (1) clase Tailwind en el
  componente → (2) `classNames`/`styles` semánticos (`body`, `icon`, `content`…) → (3) regla
  global en `globals.css` dentro de `@layer components`, comentando el porqué. Los selectores
  `.ant-*` a mano **solo** se permiten en el nivel 3 y para arreglos transversales; nunca un
  selector suelto fuera de `@layer`, ni `!` para forzar (rompe el orden de capas).

- **Iconos → `lucide-react` por defecto, siempre.** Prohibido `@ant-design/icons` (removido).
  Naming PascalCase sin `Outlined`, `size` explícito y color por `currentColor` (clases `text-*`).
  **`react-icons` es la única excepción**, y solo a pedido explícito del usuario cuando un ícono
  puntual de lucide no lo convence — nunca a iniciativa propia ni como reemplazo general. Detalle
  en `docs/frontend/styling-guide.md` (sección Iconos).

- **Fechas → siempre formateadas con `dayjs`** vía el helper `src/lib/date` (hook
  `useDateFormatter` en componentes). Prohibido `toLocaleDateString`, `Intl.DateTimeFormat`
  y formatos a mano. Locale-aware (es/en). Detalle en `docs/frontend/styling-guide.md` (sección Fechas).

- **Arquitectura de features → `docs/frontend/architecture.md` es la spec estricta.**
  **Leerla antes** de crear o modificar cualquier feature/UI de la web app, y seguir su patrón
  (feature-sliced, `DataTable` + card en móvil, hooks tRPC, `<Can>`/`useCan`, i18n). Es genérica
  (usa placeholders `X`/`<feature>`); no asumir el patrón de memoria.

---

## Backend / API (`apps/api`) — REGLAS OBLIGATORIAS

- **Arquitectura de módulos → `docs/backend/architecture.md` es la spec estricta.**
  **Leerla antes** de crear o modificar un módulo de la API, y seguir su patrón
  (`resource → repository → service → router`, `guardedProcedure` + `@repo/guards`, errores con
  `AppError`/`ErrorCodes`, listas paginadas `Paginated`). Es genérica (usa placeholders `X`/`<module>`).

---

## Comandos

```bash
pnpm dev                          # levantar todo (web:3000, api)
pnpm --filter web dev             # solo web
pnpm --filter web check-types     # type-check web (tsc --noEmit)
pnpm check-types                  # type-check monorepo
```

> Si necesitas limpiar `apps/web/.next`, **detén antes el dev server** (borrarlo en caliente
> corrompe su caché y provoca 500).

## Workflow con Claude

- **Nunca levantar servidores ni correr pruebas en vivo** (`pnpm dev`, abrir el navegador, probar
  una feature end-to-end, etc.). Eso lo hace siempre el usuario. Tras un cambio de UI/feature,
  describir qué probar y dejar que el usuario lo verifique — no intentar levantar el server ni
  el browser para comprobarlo.
- **`check-types` (`pnpm check-types` / `pnpm --filter <app> check-types`) sí se puede correr
  libremente**, sin pedir permiso — no es una prueba en vivo, solo type-check estático.
