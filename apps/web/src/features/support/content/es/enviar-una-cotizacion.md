"Crear cotización" no envía nada al cliente — solo confirma que la cotización está completa y le
saca la marca de borrador. Enviarla es un paso aparte.

## Cómo enviar una cotización

Enviar una cotización significa moverla de **Pendiente** a **Enviada**. Se puede hacer de dos
formas:

- Desde el **Pipeline**, arrastrando la tarjeta a la columna "Enviada" (en desktop) o eligiendo
  "Mover a…" desde el menú de la tarjeta (en mobile).
- Tocando el tag de estado, arriba del armador o del detalle de la cotización, y eligiendo la
  etapa siguiente.

![Mover la cotización a Enviada desde el tag de estado](/support/enviar-una-cotizacion/1.png)

Antes de pasar a Enviada, se vuelve a confirmar que estén cargados Estado, Ciudad, Dirección y al
menos una línea. Si falta algo, aparece el mensaje "Faltan datos para enviar la cotización" —
puede pasar incluso después de haber hecho "Crear cotización", si en el medio se borró algún dato.

> Enviar una cotización no le manda ningún email ni WhatsApp al cliente en forma automática.
> "Enviada" es una etiqueta de seguimiento interno — compartir el PDF con el cliente (por link,
> descarga, o por fuera de la app) es una acción manual del staff.

## Generar y compartir el PDF

El botón "Generar PDF" (o "Ver PDF") aparece recién cuando la cotización está **Enviada** o
**Aprobada** — antes de eso todavía no hay PDF para compartir.

Si la cotización se edita después de generar el PDF, la próxima vez que se abra "Ver PDF" se
genera uno nuevo automáticamente con los cambios, evitando compartir por error una versión vieja.
Cada PDF queda guardado con su fecha de generación.

![Botón Generar PDF / Ver PDF](/support/enviar-una-cotizacion/2.png)

## Fecha de vencimiento

Cada cotización tiene una fecha de vencimiento que se calcula sola al crearla: la fecha de
creación más los meses de validez configurados en Ajustes (3 meses por defecto). Es un valor
general de la cuenta — no se ajusta cotización por cotización, y solo afecta a las que se creen
de ahí en adelante.

Si esa fecha pasa y la cotización sigue en Enviada, aparece un tag rojo de "Vencida" en el
pipeline y en la tabla. Es solo un aviso visual: si el cliente responde tarde, igual se puede
aprobar.
