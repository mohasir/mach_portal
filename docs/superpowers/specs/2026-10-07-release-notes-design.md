# Novedades por release (modal "Novedades") — Diseño

> Estado: **implementado** (plan: `docs/superpowers/plans/2026-10-07-release-notes.md`). Rama: `feat/release-notes` (desde `dev`). Specs de patrón:
> `docs/frontend/architecture.md`, `docs/backend/architecture.md`, `docs/frontend/styling-guide.md`.

---

## 1. Objetivo

Que el usuario de la app se entere de lo nuevo de cada release (features, mejoras, correcciones) sin
avisarle por fuera, con un modal de **novedades** que se muestra **una sola vez por deploy** y no se
vuelve a mostrar después de verlo.

La app es una PWA y el cliente es una sola persona, que puede usarla en más de un dispositivo.

### Criterios de éxito

- Tras un deploy con novedades, cada usuario existente ve el modal **una vez**, en el primer
  dispositivo donde abra la app; en los demás ya no aparece.
- Cerrar, saltar o terminar el modal lo marca como visto.
- Un usuario nuevo no ve novedades hasta el siguiente deploy que traiga novedades.
- Agregar las novedades de un release es crear un archivo en el código; no requiere base de datos
  ni panel de administración.

---

## 2. Alcance

### Dentro

- Contenido de novedades versionado en el código de la web, en es y en, con un ícono opcional por
  diapositiva (sin imágenes: se descartaron durante la implementación).
- "Última versión vista" por usuario, guardada en el servidor (`user_preferences`).
- Modal tipo carrusel con Saltar / Atrás / Siguiente / Continuar.
- Tests de la lógica de decisión, de la comparación de versiones, del registro de contenido y del
  schema de preferencias.
- Documentación del paso "agregar novedades" en el flujo de release.

### Fuera

- Volver a ver novedades pasadas (ej. una sección "Novedades" en Configuración).
- Audiencia por rol: el modal lo ven **todos** los usuarios logueados.
- Contenido editable desde la app.
- Mostrar más de una versión a la vez: si el usuario se salteó varios deploys, ve **solo la última**.
- Avisos de "hay una versión nueva, recargá": la PWA ya activa la versión nueva sola
  (`skipWaiting` + `clientsClaim` en `src/app/sw.ts`).

---

## 3. Contenido y versión

### 3.1 Versión actual

`next.config.ts` ya lee `version` de `apps/web/package.json` y la expone como
`NEXT_PUBLIC_APP_VERSION` (tipada en `src/env.ts`); el gate la toma de `env`. No se importa
`package.json` en el cliente (metería la lista de dependencias en el bundle).

### 3.2 Archivos de contenido

```
apps/web/src/features/release-notes/
├── content/
│   ├── index.ts          # RELEASE_NOTES: Record<versión, ReleaseNote>
│   └── 0.17.0.ts         # un archivo por versión con novedades
...
```

```ts
type LocalizedText = { es: string; en: string };

type ReleaseNoteSlide = {
  title: LocalizedText;
  description: LocalizedText;
  icon?: IconType; // react-icons/tb, se muestra con destellos decorativos
};

type ReleaseNote = {
  version: string; // igual a su clave en RELEASE_NOTES
  slides: ReleaseNoteSlide[]; // al menos 1
};
```

- Cada texto lleva es **y** en (la app es bilingüe y el idioma es una preferencia por usuario); el
  tipo obliga a completar ambos.
- Si para la versión actual no hay archivo, no se muestra nada.

---

## 4. "Visto" y cuándo se abre

### 4.1 Persistencia

Nueva clave en `packages/schemas/src/userPreferences.ts`:

- Lectura: `lastSeenReleaseNotes: z.string().optional().catch(undefined)`.
- Actualización parcial: `lastSeenReleaseNotes: z.string()` dentro del `.partial()`.

La API no cambia: `userPreferences.update` ya fusiona en SQL solo las claves enviadas, y la tabla es
jsonb (sin migración).

### 4.2 Decisión

Función pura en la web (`features/release-notes/helpers.ts`):

```ts
resolveReleaseNotesAction({ currentVersion, lastSeen, hasNotes }): 'show' | 'markSeen' | 'none'
```

| Situación | Resultado |
|---|---|
| Sin `lastSeen` (usuario nuevo o primer deploy de esta feature) | `markSeen`: guarda la versión actual sin mostrar |
| `lastSeen` igual a la actual | `none` |
| Actual **mayor** que `lastSeen` y con archivo de novedades | `show` |
| Actual mayor que `lastSeen`, sin archivo de novedades | `none` (no escribe) |
| Actual **menor** que `lastSeen` (rollback) | `none` |

- La comparación es semver numérica (`0.10.0 > 0.9.0`), con un helper `compareVersions(a, b)`.
- Consecuencia buscada: el **primer deploy** que incluye esta feature no muestra el modal a nadie
  (todos quedan en `markSeen`); funciona desde el siguiente deploy con novedades.

### 4.3 Dónde se evalúa

- `<ReleaseNotesGate />` montado una vez en el shell del panel (`AdminLayoutContainer`); no aparece
  en el login.
- Espera a que la sesión y las preferencias estén cargadas antes de decidir, para no abrir y cerrar
  el modal.
- Al cerrar, saltar o continuar: el modal se cierra al instante y en segundo plano se guarda
  `lastSeenReleaseNotes = versión actual`. Si el guardado falla no se muestra error; el modal
  vuelve a aparecer en la próxima carga. Por eso usa una mutación propia
  (`useMarkReleaseNotesSeen`) sin el toast de error de `useUpdateUserPreferences`.

---

### 4.4 Feature flag

- `app_settings.show_release_notes` (boolean, **default `false`**), expuesto en `config.get` como
  `appSettings.showReleaseNotes` (todos los roles lo leen).
- Se cambia con `config.updateReleaseNotesPreferences` (`updateReleaseNotesPreferencesSchema`),
  gateado por el recurso nuevo `RELEASE_NOTES_PREFERENCES` (`VIEW` + `UPDATE`, **solo superadmin**).
- UI: card "Novedades" con el switch "Mostrar novedades" en Configuración → Funcionalidades.
- Apagado: `resolveGateState({ enabled: false, ... })` → `none`; no se muestra ni se guarda nada, así
  que encenderlo y apagarlo no tiene efectos secundarios. Requiere `db:push`.

## 5. El modal

- Base: `WrapperModal` (centrado, 90 % del ancho en móvil, 480 px desde `md`).
- **Encabezado:** a la izquierda "Novedades" + tag con la versión (`v0.17.0`); a la derecha
  **"Saltar"** (botón de texto) en todas las diapositivas salvo la última, en lugar de la X. Máscara y
  Esc también cierran y marcan como visto.
- **Diapositiva** (`Carousel` de AntD controlado por ref: puntos y swipe en móvil):
  - Con ícono (`ReleaseNoteHero`): bloque de fondo gris con el ícono en una insignia del color
    primario y destellos de cuatro puntas en `mustard` (decorativos, `aria-hidden`); debajo título
    (centrado, semibold) y descripción (centrada, gris).
  - Sin ícono: solo título y descripción; el bloque de texto tiene alto mínimo.
- **Botones:** "Atrás" (outline) y "Siguiente" (primario), mitad y mitad; "Atrás" deshabilitado en
  la primera; en la última "Siguiente" pasa a **"Continuar"**. Con una sola diapositiva: sin puntos
  ni "Atrás", solo "Continuar" a todo el ancho.
- **Textos fijos** (Novedades, Saltar, Atrás, Siguiente, Continuar) en un namespace i18n nuevo
  `releaseNotes` (es/en). El contenido usa el idioma del usuario; las imágenes llevan `alt`
  traducido.
- Íconos, estilos y mobile-first según `docs/frontend/styling-guide.md` y `CLAUDE.md`.

---

## 6. Pruebas

**Vitest (TDD):**

1. `resolveReleaseNotesAction`: los cinco casos de §4.2.
2. `compareVersions`: mayor (incluye `0.10.0 > 0.9.0`), igual y menor.
3. Registro de contenido (`content/index.ts`): cada clave coincide con `version`, cada release tiene
   al menos una diapositiva.
4. Schema de preferencias: `lastSeenReleaseNotes` ausente o inválido no rompe el resto de las claves;
   el update parcial lo acepta.

**Manual (móvil primero, después desktop):** con y sin ícono; una y varias diapositivas; swipe;
Saltar, clic en la máscara, Esc y Continuar marcan visto; no reaparece al recargar ni en otro dispositivo;
usuario nuevo no lo ve; idioma en/es.

---

## 7. Flujo de release

1. Subir `version` en `apps/web/package.json` (como en el changelog).
2. Si el release tiene algo visible para el cliente: crear
   `features/release-notes/content/<versión>.ts` (es/en, ícono opcional).
3. Registrarlo en `content/index.ts`.

Se documenta en `docs/frontend/architecture.md` (sección corta) para que el paso no dependa de la
memoria.

---

## 8. Ramas y despliegue

- Se trabaja en `feat/release-notes` desde `dev`, PR hacia `dev`. **No pasa a `staging`** hasta
  nuevo aviso: la reprogramación de eventos (ya en `staging`) puede ir a producción antes.
- Riesgo: mientras esto esté en `dev`, un merge `dev` → `staging` lo arrastraría. Los arreglos de la
  reprogramación previos a producción van por una rama desde `staging`, o el PR de esta feature se
  mantiene abierto sin mergear hasta que la reprogramación esté en producción.
- Base de datos: columna `app_settings.show_release_notes` (`db:push` antes del deploy). Permisos:
  recurso `RELEASE_NOTES_PREFERENCES` (superadmin). Contrato tRPC: clave opcional en
  `userPreferences`, `appSettings.showReleaseNotes` y `config.updateReleaseNotesPreferences`.

---

## 9. Decisiones

| # | Decisión | Por qué |
|---|---|---|
| N1 | Contenido en el código, un archivo por versión | Las novedades siempre salen con un deploy; sin tabla ni panel. |
| N2 | "Visto" en `user_preferences` (servidor) | "Una sola vez" real con varios dispositivos; reutiliza infraestructura sin migración. |
| N3 | Solo la última versión, nunca acumuladas | Pedido explícito: las versiones salteadas no se muestran. |
| N4 | Usuario sin registro → `markSeen` sin mostrar | Usuarios nuevos no ven novedades viejas; el primer deploy de la feature no muestra a nadie (aceptado). |
| N5 | Todos los usuarios logueados | Cliente único; audiencia por rol no hace falta. |
| N6 | Carrusel con ícono opcional y "Saltar" | Referencia visual del usuario; saltar es obligatorio. Las imágenes se descartaron: un ícono con destellos no requiere capturas que mantener. |
| N7 | Textos es/en obligatorios por tipo | App bilingüe con idioma por usuario. |
| N8 | Feature flag solo superadmin, apagado por defecto | Decidir cuándo empezar a mostrar novedades sin un deploy; mismo patrón que "Sugerir actualización de tasas". |
