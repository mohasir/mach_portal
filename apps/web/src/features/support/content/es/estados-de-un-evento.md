Un evento tiene 3 estados posibles. A diferencia de las cotizaciones, **no es un campo que se
guarda** — se calcula cada vez que se muestra:

- **Cancelado**: si la cotización de origen está en etapa Cancelada.
- **Realizado**: si no está cancelado y ya se marcó como realizado.
- **Próximo**: en cualquier otro caso.

## Marcar un evento como realizado

Botón "Marcar realizado" en la ficha del evento (solo visible mientras está Próximo).

- **No tiene precondiciones**: se puede marcar como realizado aunque falte cobrar o falten
  opciones por confirmar — el sistema no lo bloquea.
- Pide confirmación y es **irreversible**: no hay forma de "desmarcarlo" desde la interfaz una vez
  hecho.
- Si la fecha del evento ya pasó y sigue Próximo, aparece un aviso "Vencido" con un atajo directo
  a este mismo botón — es solo un recordatorio, no bloquea nada más.

![Botón "Marcar realizado" y su confirmación](/support/estados-de-un-evento/1.png)

## Cancelar un evento

El botón "Cancelar evento" **en realidad cancela la cotización de origen** — no existe una
cancelación de evento independiente. El mensaje de confirmación lo dice explícitamente. Solo está
disponible mientras el evento está Próximo (no se puede cancelar uno ya Realizado).

![Botón "Cancelar evento" y su confirmación](/support/estados-de-un-evento/2.png)

El personal asignado y los pagos ya registrados **no se tocan** al cancelar — quedan intactos. Si
después alguien reactiva esa cotización, el mismo evento vuelve a estar activo con todo lo que ya
tenía cargado (no se duplica ni se crea uno nuevo).

## Un detalle a tener en cuenta

Un evento con la fecha ya pasada que nadie marcó como realizado **no desaparece ni se archiva
solo** — sigue apareciendo como "Próximo" indefinidamente hasta que alguien lo marque a mano.
