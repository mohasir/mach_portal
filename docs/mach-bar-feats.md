# Mach Bar — Alcance actual (features)

> Qué puede hacer hoy alguien que usa el portal, feature por feature. Es una foto del **alcance
> funcional actual**, no el plan de construcción (`mach-bar-plan.md`, con bitácora técnica y estado
> de avance por fase) ni la spec completa de diseño de todas las superficies incluyendo las que aún
> no existen (`mach-bar-flows.md`). Actualizar cuando el alcance cambie (nueva feature, feature
> cerrada).

**Última actualización:** 2026-07-14.

---

## Resumen ejecutivo

Hoy se puede llevar una oportunidad de negocio **desde que entra un lead hasta que la cotización
queda confirmada** (cliente → armar cotización con el catálogo real → moverla por el pipeline hasta
`confirmed`). Lo que **todavía no existe** es la parte operativa posterior: el **evento en sí**
(seguimiento de pagos, asignación de staff, marcar como realizado) y el **dashboard** de métricas.
Ese es el corte exacto: el sistema termina en "cotización confirmada" y no en "evento entregado".

| Área | Alcance hoy |
|---|---|
| Clientes | ✅ CRUD completo |
| Staff | ✅ CRUD completo |
| Catálogo (estaciones/secciones/ítems + precios) | ✅ funcional — faltan datos reales de precio en 7 de 10 estaciones |
| Tipos de evento | ✅ CRUD completo |
| Configuración (impuestos, depósito, validez, etc.) | ✅ completo |
| Cotizaciones (lista + constructor + pipeline) | ✅ completo, hasta `confirmed` |
| **Eventos** | ❌ no existe (placeholder de nav únicamente) |
| **Ficha de cliente 360** (historial quotes+events) | ❌ no existe (depende de eventos) |
| **Dashboard** | ❌ no existe |

---

## Clientes — `/admin/clients`

CRUD estándar: alta, edición, baja, listado con búsqueda/paginado (desktop tabla, móvil cards).

- Cada cliente tiene un **estado derivado** — `lead` o `active` — que el sistema calcula solo:
  pasa a `active` en cuanto tiene al menos una cotización `confirmed` o `completed`. No es un campo
  editable a mano.
- **No existe todavía** la ficha de cliente con historial (ver más abajo, "Fuera de alcance").

## Staff — `/admin/staff`

CRUD estándar del personal (nombre, teléfono, email, activo/inactivo). Sirve como catálogo de
personas asignables a eventos — pero la asignación en sí (botón "Asignar" en el pipeline) todavía
no funciona porque depende del módulo de eventos.

## Catálogo — `/admin/catalog` (+ `/admin/prices`)

Define el "menú" del negocio: qué **estaciones** (productos) existen, con qué **secciones** (grupos
de ítems) y qué **ítems** tiene cada una. Es lo que alimenta el constructor de cotizaciones.

- Árbol de 3 niveles en acordeón (Estación → Sección → Ítem), reordenable por drag (desktop) o
  flechas (móvil). Todo con soft-delete: nunca se borra, solo se activa/desactiva.
- Cada **estación** tiene una **tabla de precios por paquete** (cantidad de personas → precio
  total). En la cotización se elige uno de esos paquetes, y el precio precargado es editable línea
  por línea.
- Cada **sección** es *seleccionable* (el cliente elige hasta un máximo de ítems, o sin límite) o
  *incluida* (informativa, no se elige — ej. "Syrups Premium incluidos").
- Superficie aparte **`/admin/prices`** para editar solo las tablas de precio sin entrar al editor
  completo — pensada para el caso de uso más frecuente (actualizar precio) sin tocar la estructura.
- Un setting en Configuración (`Catálogo ordenable`) permite bloquear el reorder manual una vez que
  el orden está definido.
- **Dato pendiente**: de las 10 estaciones cargadas, solo **Mini Pancakes, Crepaletas y Esquites**
  tienen precios reales; las otras 7 (Crepes, Nachos, Fruit Station, Snack Station, Popsicles, Hot
  Chocolate, Craft Bar) tienen precios *placeholder*. Craft Bar además necesita definirse si su
  modelo de precio es fijo o por hora antes de poder cargarle precios reales.

## Tipos de evento — `/admin/event-types`

Lista plana administrable (Boda, Cumpleaños, Corporativo, Baby Shower, Aniversario, Graduación,
Otro), con soft-delete. Alimenta el selector de tipo de evento en el constructor de cotizaciones.

## Configuración — `/admin/settings`

Parámetros de negocio que alimentan las cotizaciones nuevas (los cambios **no** afectan
cotizaciones ya emitidas, que guardan su propio snapshot):

- **Impuestos por estado** (NY/NJ/CT, cada uno con su tasa).
- **Depósito por defecto**, **validez** (meses), **mínimo de personas por línea**, **inicio del
  consecutivo** de cotización (con validación: no puede ser menor al último número ya usado).
- **Moneda** de visualización de montos.
- Preferencia de **catálogo ordenable** (activa/desactiva el reorder manual, ver arriba).

Solo visible/editable por `admin`/`superadmin`.

## Cotizaciones — `/admin/quotes`, `/admin/quotes/new`, `/admin/pipeline`

La feature más grande y el corazón del flujo comercial hoy. Tres superficies:

### Lista — `/admin/quotes`
Listado estándar con filtros por etapa (`stage`) y estado (US). Click en una fila abre el
detalle/constructor. No tiene acciones destructivas — los cambios de etapa se hacen desde el
pipeline.

### Constructor — `/admin/quotes/new` y `/admin/quotes/[id]`
Formulario con **preview en vivo** del documento final (2 columnas en desktop, barra inferior +
Drawer de preview en móvil):

- Elegir cliente existente o dar de alta un **lead nuevo sin salir del formulario** (mini-form de
  nombre + teléfono).
- Datos del evento (tipo, fecha, hora, estado, dirección).
- Armar líneas eligiendo una **estación** del catálogo, un **paquete** (precio precargado y
  editable), y las opciones de cada sección (respetando el máximo por sección).
- Descuento (monto fijo o %), impuesto según el estado elegido, depósito — todo calculado en vivo
  con la misma fórmula que usa el servidor (lo que se ve en el preview es exactamente lo que se
  guarda y lo que va al PDF).
- Se puede **guardar como borrador** incompleto (aparece igual en el pipeline) o **enviar**
  (requiere que esté completo: cliente, estado, dirección, ≥1 línea).
- **Descargar PDF** una vez guardada.
- Editable solo mientras la etapa es *Borrador* o *Enviada*; desde *Confirmada* queda de solo
  lectura.

### Pipeline — `/admin/pipeline`
Tablero kanban de las 5 etapas de una cotización: **Borrador → Enviada → Confirmada → Realizada →
Cancelada** (con reapertura posible de Cancelada → Enviada). Desktop: drag & drop entre columnas.
Móvil: pestañas por etapa + menú "Mover a…" (misma acción que el drag).

- Solo se permiten los movimientos válidos según una matriz de transiciones fija (no se puede saltar
  de Borrador a Confirmada, por ejemplo); el intento inválido no se ejecuta.
- **Confirmar** una cotización pide confirmación explícita — **hoy este paso NO crea un evento
  todavía** (ver "Fuera de alcance"), solo cambia la etapa.
- El botón "Asignar staff" que aparece en las cards de *Confirmada* está en la UI pero **no hace
  nada todavía** (depende del módulo de eventos).

---

## Fuera de alcance por ahora

### Eventos

No existe ningún flujo operativo posterior a "cotización confirmada". Hoy `/admin/events` es un
placeholder vacío. Falta:

- Que **confirmar una cotización cree el evento** correspondiente (hoy solo cambia la etapa de la
  cotización, no genera nada más).
- **Detalle de evento**: ver la composición (heredada de la cotización, de solo lectura), marcar
  depósito/saldo pagado y método de pago, marcar el evento como realizado o cancelarlo.
- **Asignación de staff** a un evento (disponibilidad por fecha) — el botón ya visible en el
  pipeline pasaría a funcionar recién acá.
- **Lista de eventos** estándar.

### Ficha de cliente 360 (`/admin/clients/[id]`)

Vista con historial de cotizaciones y eventos de un cliente. No se puede construir hasta que exista
el módulo de eventos (necesita ambos).

### Dashboard (`/admin`)

Métricas del mes (eventos, ingresos, cotizaciones, tasa de cierre), próximos eventos y productos más
pedidos. No implementado — depende de que haya eventos para tener datos que agregar.

---

## Permisos (quién puede hacer qué)

Todo lo documentado arriba está gateado por rol vía `@repo/guards`:

| Rol | Acceso |
|---|---|
| `superadmin` | Acceso total a todas las features (bypass explícito de la matriz de permisos) |
| `admin` | Mismo CRUD completo que `superadmin` en todos los recursos de Mach Bar |
| `member` | **Sin acceso** a ninguna feature de Mach Bar todavía (clientes, staff, catálogo, cotizaciones, etc.) — la matriz no le da permisos en ningún recurso |

Si se necesita que `member` opere alguna de estas pantallas (ej. ventas armando cotizaciones sin ser
admin), es una decisión de producto pendiente — hoy el rol existe pero no tiene ningún permiso
otorgado en este dominio.
