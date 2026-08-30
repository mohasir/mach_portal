El Pipeline (`Cotizaciones → vista Pipeline`) es la vista por defecto para trabajar cotizaciones:
un tablero kanban con una columna por etapa.

![Pipeline de cotizaciones](/support/pipeline-de-cotizaciones/1.png)

## Cómo mover una tarjeta

- **Desktop**: se arrastra la tarjeta a la columna deseada (drag & drop).
- **Mobile**: no hay drag táctil — se usa el menú "Mover a…" de la tarjeta.
- Mover una tarjeta a **Aprobada** o **Cancelada** siempre pide confirmación.
- Solo se permiten movimientos válidos según las reglas de etapas (ver
  [Estados de una cotización](/admin/settings/support/estados-de-una-cotizacion)) — cualquier otro
  movimiento se rechaza.

## Qué muestra cada tarjeta

Número de cotización (copiable con un clic), tag "Borrador" (rojo si le faltan datos para poder
enviarse, gris si está completa), tag "Vencida" si corresponde, cliente, tipo de evento, fecha del
evento, total y cantidad de líneas.

## Por qué la columna Cancelada muestra menos que las otras

Las columnas Pendiente, Enviada y Aprobada siempre cargan **todas** las cotizaciones abiertas, sin
límite de fecha. La columna **Cancelada, en cambio, solo muestra las canceladas del mes actual**
(según la fecha del último cambio de etapa), para que no crezca sin límite. Una cotización
cancelada hace tiempo no aparece ahí, aunque siga existiendo — se la encuentra igual en la vista
de Tabla.

## Asignar staff desde la columna Aprobada

Las tarjetas de la columna Aprobada muestran los avatares del personal ya asignado al evento y un
botón para **asignar personal** directamente, sin salir del pipeline (abre la disponibilidad de
staff para esa fecha).

![Asignar personal desde una tarjeta Aprobada](/support/pipeline-de-cotizaciones/2.png)

## Al hacer clic en una tarjeta

- Si está en **Pendiente**, se abre el armador (editable).
- En cualquier otra etapa, se abre la vista de detalle/preview (de solo lectura en su contenido,
  con las acciones de PDF y cambio de estado disponibles).
