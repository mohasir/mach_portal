Cada estación puede tener secciones de opciones (ingredientes, sabores, extras). Hay dos momentos
posibles para elegirlas, y cuál se usa depende de un switch global.

## Los dos modos

- **Elegir después (por defecto)**: al armar la cotización solo se elige la estación y el paquete
  según la cantidad de personas. Las opciones de cada sección quedan pendientes y se completan más adelante, desde la
  ficha del evento ya aprobado.
- **Elegir ahora**: si el equipo de soporte activó el switch "Permitir elegir opciones al cotizar"
  en Configuración → Preferencias, aparece un switch **"Elegir opciones ahora"** en el armador.
  Activándolo, las opciones de cada estación se eligen ahí mismo, al momento de cotizar.

Si el switch global está apagado, esta opción no aparece en el armador — todas las cotizaciones
nuevas quedan en modo "elegir después" sin poder cambiarlo.

![El switch "Elegir opciones ahora" en el armador](/support/elegir-opciones-al-cotizar/1.png)

## Qué pasa según el modo elegido

Cuando la cotización se aprueba y se convierte en evento:

- Si se cotizó en modo **"Elegir ahora"**: el evento nace con las opciones ya resueltas — no queda
  nada pendiente.
- Si se cotizó en modo **"Elegir después"**: el evento nace con las opciones pendientes, y alguien
  del staff tiene que completarlas desde la ficha del evento antes de la fecha límite configurada.
  Más detalle en
  [Completar las opciones pendientes de un evento](/admin/settings/support/completar-opciones-pendientes).

## Cómo funciona elegir dentro de una sección

- **Sección "Incluido"**: viene con todas sus opciones marcadas, sin poder tocarlas.
- **Sección "Seleccionable"**: se pueden elegir varias opciones, hasta el máximo que tenga
  definido esa sección (sin máximo definido, no hay límite). Al llegar al tope, las opciones no
  elegidas se deshabilitan hasta destildar alguna.
- **No hay mínimo**: una sección seleccionable puede quedar sin ninguna opción marcada y la
  cotización se puede enviar igual.

![Elegir opciones dentro de una sección seleccionable](/support/elegir-opciones-al-cotizar/2.png)

Si el switch global cambia después de que ya existían cotizaciones armadas con opciones elegidas,
esas cotizaciones **conservan** lo que ya tenían — el cambio solo afecta a las nuevas.
