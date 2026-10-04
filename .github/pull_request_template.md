<!--
Título del PR: <tipo>(<ámbito>): <resumen en imperativo>
  ej. feat(quotes): add shared filter bar for table and pipeline
  tipos: feat · fix · refactor · perf · docs · chore · test
Un PR = un cambio coherente. Si el resumen necesita "y", probablemente son dos PRs.
-->

## Resumen

<!-- Qué cambia, en 1–3 frases, para alguien que no estuvo en la conversación. -->

## Contexto

<!-- Por qué hace falta: problema, bug o pedido. Enlazá issue/ticket/SDD si existe. -->

## Cambios

<!-- Lista corta agrupada por capa. Mencioná decisiones no obvias y alternativas descartadas. -->

- **API:**
- **Web:**
- **Schemas / Guards:**

## Tipo de cambio

- [ ] Bug fix (no rompe nada existente)
- [ ] Feature nueva
- [ ] Refactor / mejora interna (sin cambio de comportamiento)
- [ ] Breaking change (cambia contrato de API, schema o comportamiento existente)
- [ ] Docs / configuración

## Impacto y despliegue

<!-- Borrá lo que no aplique. -->

- [ ] **Base de datos:** requiere `pnpm --filter api db:push` (detallá tablas/columnas nuevas) — correr **antes** del deploy.
- [ ] **Permisos:** agrega/cambia recursos o acciones en `@repo/guards` (qué roles los reciben).
- [ ] **Variables de entorno** nuevas o modificadas.
- [ ] **Contrato tRPC:** cambia inputs/outputs consumidos por el front.
- [ ] Sin impacto de despliegue.

## Cómo probar

<!-- Pasos concretos y reproducibles, con datos/rol necesarios. Incluí casos borde. -->

1.
2.
3.

## Capturas

<!-- Obligatorio si cambia UI: móvil y desktop (antes/después si aplica). -->

| Móvil | Desktop |
| ----- | ------- |
|       |         |

## Checklist

- [ ] `pnpm check-types` pasa.
- [ ] Probado en **móvil** y desktop (mobile-first).
- [ ] Textos visibles traducidos en **es** y **en** (sin strings hardcodeados).
- [ ] Estilos según `docs/frontend/styling-guide.md` (AntD + Tailwind, sin hex ni inline styles; overrides con la escala definida).
- [ ] Sigue `docs/frontend/architecture.md` / `docs/backend/architecture.md`.
- [ ] Fechas con `useDateFormatter`; íconos con `lucide-react`.
- [ ] Comentarios en inglés y solo donde aportan el *por qué*.
- [ ] Sin secretos ni archivos `.env` en el diff.
- [ ] Docs actualizadas si cambian reglas de dominio o arquitectura.

## PRs relacionados

<!-- Si es parte de un stack: base, PR anterior y siguiente. -->

- Base:
- Depende de:
- Sigue con:
