# Traspaso — arranque de la fase 2 multi-tenant

Estado al 2026-11-06. Rama de trabajo: `multitenant` (incluye todo `feat/mt-fase-1-tenancy`).

## Contexto del proyecto

- `main` es el portal del cliente real y no se toca. La rama `multitenant` es un proyecto aparte:
  por ahora un **demo para buscar clientes nuevos**. No hay producción multi-tenant ni se migra al
  cliente real (la migración 0001 y su runbook de cutover quedan como referencia).
- Las carencias conocidas (RLS, claves de PDF sin prefijo de tenant, crons sin registrar,
  configuración del proxy) son endurecimiento posterior, no bloqueos del demo.

## Qué quedó hecho en la fase 1

- El tenant sale de `session.activeOrganizationId`; la web nunca manda un tenant.
- Cadena de procedures: `authedProcedure` → `tenantProcedure` → `protectedProcedure` (miembro o
  admin de plataforma, este último auditado en `platform_access_log`) → `guardedProcedure`. El
  guard de Express `guardTenantSession` repite la misma cadena.
- Módulos `xModule(ctx)`, repositories `(db, tenantId)` con `tenantEq`, ids de `input` resueltos
  dentro del tenant (receta en `docs/backend/architecture.md` §11).
- `lib/tenancy` (infraestructura previa al `ctx`): `tenantEq`, resolver con caché, regla de acceso,
  `createTenant` y `TenancyRepository`.
- Web: feature `tenant` (`TenantGate`, `/select-organization`, sincronización entre pestañas por
  `BroadcastChannel`, `useSignOut`). Ver `docs/frontend/architecture.md` §9.3.
- Migración `0001_multitenant_core`, `mt:verify`, `tenant:create` y datos de demo
  (`db:fresh`: organizaciones `demo-norte` y `demo-sur`).
- Endurecimiento HTTP: guard de Origin, cabeceras de seguridad, tope de 20 llamadas por batch,
  errores genéricos en 500.
- Rebrand a OraviCloud incluido en la rama.

## Cómo probarlo

- `pnpm --filter api db:fresh` deja la base con la demo (contraseña `admin123*` o `SEED_PASSWORD`).
- Usuarios: `superadmin|admin|operator|member1|member2@norte.demo` y `@sur.demo`;
  `shared@demo.test` (operator en Norte, member en Sur); `platform@demo.test` (admin de plataforma
  sin membresía).
- Pruebas manuales pendientes: `docs/superpowers/runbooks/multitenant-regression-checklist.md`,
  el cambio de organización con dos pestañas abiertas y un logout sin errores en consola.
- `--demo=local` se niega a correr con `NODE_ENV=production`.

## Qué cubre la fase 2

Roles y matriz rol→permisos en base de datos, editables desde el portal. Hoy los roles son fijos
en `packages/guards` y la autorización lee el rol **global** del usuario (`user.role`), no el de
su membresía.

Consecuencias actuales de ese rol global, a resolver en la fase 2:

- Un admin de tenant no puede editar, borrar ni regenerar el enlace de una cuenta que pertenece a
  otra organización o a un admin de plataforma.
- Asociar a un tenant una cuenta que ya existe es solo para admin de plataforma.
- `createTenant` y el alta de usuarios solo reescriben el rol global cuando la cuenta no tiene
  otras membresías.

## Decisiones abiertas

- **Superadmin sin elegir organización.** Hoy un superadmin con varias membresías, o un admin de
  plataforma, elige organización al iniciar sesión. Opciones: recordar la última organización
  (recomendada), un panel global `/platform` (fase 4) o entrar a la primera.
- Fases posteriores: 1b RLS, 3 branding, 4 planes, feature flags y panel `/platform`.

## Pendientes menores

Detalle en `.superpowers/sdd/2026-10-19-multitenant-fase1/refactor-survey.md` (carpeta local, no
versionada), sección «Defer». Los más relevantes:

- Una sola verificación de membresía por request en lugar de una por capa.
- Centralizar la creación de cuentas (hoy repartida entre `users.service` y `createTenant`).
- Índices compuestos de tablas hijas, en una migración 0002.
- Tipar el usuario de la sesión en lugar de castear.
- `TenantRepository.findById` repite a `TenancyRepository.findById`.

La misma carpeta local contiene `progress.md` (decisiones R1 a R14), `e2e-security-report.md`
y `final-review.md`.

## Cómo arrancar la fase 2

1. `git checkout multitenant`.
2. Leer: el spec de la fase 1 (`docs/superpowers/specs/2026-10-19-multitenant-fase1-design.md`),
   `docs/backend/architecture.md` §11, `docs/frontend/architecture.md` §9.3 y este archivo.
3. Plantearla con un brainstorming y su propio spec en
   `docs/superpowers/specs/YYYY-MM-DD-<tema>-design.md`.
