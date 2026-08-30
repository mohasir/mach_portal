Toda cotización pasa por 4 etapas fijas. No se pueden crear ni eliminar etapas nuevas — solo su
nombre, color y descripción son editables (Configuración → Estados de cotización).

![Estados en el Pipeline](/support/estados-de-una-cotizacion/1.png)

| Etapa | Qué significa | ¿Se puede editar? |
|---|---|---|
| **Pendiente** | Todavía no se envió al cliente. | Sí, libremente. |
| **Enviada** | Ya se mandó al cliente, esperando que la acepte o rechace. Tiene fecha de vencimiento. | Sí. |
| **Aprobada** | El cliente la aceptó; ya generó un evento. | No — solo lectura. |
| **Cancelada** | Se cayó, ya sea por rechazo del cliente o decisión interna. No hay un motivo distinto para cada caso. | No aplica. |

## Cómo se mueve entre etapas

- Es **lineal**: no se puede saltar de Pendiente directo a Aprobada, tiene que pasar por Enviada.
- **Aprobada es terminal hacia adelante**: no existe "des-aprobar". La única salida desde ahí es
  Cancelada.
- **Cancelada solo reabre a Enviada**, nunca vuelve a Pendiente.
- El sistema valida esto también del lado del servidor — un intento de movimiento inválido se
  rechaza con "Ese cambio de estado no está permitido", no es solo una restricción visual.

## Qué se puede editar en cada momento

Solo se puede editar el contenido de una cotización mientras está en **Pendiente** o **Enviada**.
Al abrir el armador de una cotización Aprobada o Cancelada, se muestra directamente una vista de
solo lectura.

Cada cambio de etapa (y quién lo hizo) queda registrado en la pestaña "Actividad" del detalle de
la cotización.
