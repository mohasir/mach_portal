Cancelar y archivar son dos acciones distintas, y conviene no confundirlas.

## Cancelar

- Disponible desde Pendiente, Enviada o **Aprobada** (incluso después de haber generado un
  evento). Pide confirmación explícita; no se pide un motivo.
- **No borra ningún dato**: líneas, opciones, notas, cliente, todo queda intacto — solo cambia el
  estado a Cancelada.
- Si la cotización ya estaba **Aprobada** (con evento creado), cancelarla también marca el evento
  derivado como cancelado automáticamente. El evento no se borra.

![Confirmación al cancelar una cotización](/support/cancelar-reabrir-archivar-cotizacion/1.png)

## Reabrir

Reabrir = mover una cotización Cancelada de vuelta a **Enviada** (nunca a Pendiente). Se hace
desde el mismo tag de estado o el pipeline. Una vez reabierta, vuelve a ser editable y se le puede
volver a intentar Aprobar.

> Si una cotización llegó a Aprobada (ya generó su evento) y después se cancela y se reabre,
> volver a aprobarla hace que el sistema intente crear **otro** evento para la misma cotización —
> y como cada cotización solo puede tener un evento asociado, esa segunda aprobación puede fallar
> con un error inesperado en vez de un mensaje claro. Conviene no re-aprobar una cotización que ya
> generó un evento una vez; si hace falta reactivarla, es mejor coordinarlo por fuera del flujo
> estándar o crear una cotización nueva.

## Archivar

Es una acción aparte, no es una etapa del pipeline. Está en el menú de acciones (⋮) de cualquier
cotización, **en cualquier estado**.

- Saca la cotización de la Tabla y del Pipeline por completo, sin importar en qué etapa estaba.
- **No hay forma de "desarchivar"** desde la interfaz — es una acción sin vuelta atrás.
- Sirve para cotizaciones que ya no necesitan aparecer en los listados normales, no como
  reemplazo de Cancelar.

![Menú de acciones con la opción Archivar](/support/cancelar-reabrir-archivar-cotizacion/2.png)
