Una cotización se arma desde **Cotizaciones → Nueva cotización**. El formulario tiene varias
secciones y no se autoguarda mientras se completa, así que salir sin guardar muestra un aviso de
confirmación.

![Armador de cotizaciones](/support/crear-una-cotizacion/1.png)

## Paso 1: Cliente

Hay dos formas de cargarlo, sin poder combinarlas:

- Buscar y seleccionar un **cliente existente**.
- Cargar un **cliente nuevo** sin salir del armador — solo pide nombre (obligatorio), teléfono y
  email. Este cliente no se guarda todavía en ese momento: se crea recién al guardar la
  cotización. Si se abandona el armador sin guardar, tampoco queda creado.

El cliente es el **único dato obligatorio** para poder guardar como borrador.

![Buscar un cliente existente o cargar uno nuevo](/support/crear-una-cotizacion/2.png)

## Paso 2: Datos del evento

Tipo de evento, fecha, hora, Estado (NY, NJ o CT), Ciudad y Dirección.

- No se puede elegir una fecha anterior a hoy, ni una hora ya pasada si la fecha elegida es hoy.
- La Ciudad depende del Estado elegido — es una lista cerrada, no texto libre. Si se cambia el
  Estado y la ciudad cargada no pertenece a la lista nueva, se borra sola.
- Estado, Ciudad y Dirección no son obligatorios para guardar un borrador, pero sí para poder
  **enviar** la cotización más adelante.

## Paso 3: Cargos extras

Esta sección aparece solo si tu organización tiene activo el add-on de **cargos adicionales**.
Muestra los cargos activos del catálogo (**Cargos adicionales** en el menú): se activa cada uno que
corresponda y se puede ajustar su valor para esta cotización.

- Un cargo **fijo** suma su monto.
- Un cargo **en porcentaje** se calcula sobre el total con impuesto. Si hay varios, cada uno usa
  ese mismo total (no se suman entre sí).
- Los cargos **no pagan impuesto**.

Un cargo que ya estaba en la cotización y cuyo tipo se desactivó después se conserva tal cual: solo
se puede quitar. Sin el add-on, la cotización conserva los cargos que ya tenía, pero no se pueden
agregar ni cambiar.

## Paso 4: Agregar {{items}}

Se busca el {{item}} en el catálogo y se agrega como línea, eligiendo el **paquete** según la
cantidad de personas — de una lista ya definida para ese {{item}}, no se puede escribir una
cantidad libre. El precio se precarga con el del paquete elegido, pero es editable a mano.

Las opciones de cada {{item}} (ingredientes, sabores, etc.) no se eligen acá — se completan
después, desde la ficha del evento ya aprobado. Ver
[Completar las opciones pendientes de un evento](/admin/settings/support/completar-opciones-pendientes).

![Agregar un {{item}} y elegir su paquete](/support/crear-una-cotizacion/3.png)

## Paso 5: Descuento y depósito

Tipo de descuento (ninguno, monto fijo o porcentaje) y su valor, más el porcentaje de depósito
(viene precargado del valor por defecto de Ajustes, pero se puede cambiar por cotización).

## Paso 6: Notas internas

Texto libre que **no** aparece en el PDF ni lo ve el cliente — es solo para uso interno del staff.

## Cómo se calcula el total

```text
Subtotal (líneas)
− Descuento (repartido entre las líneas)
+ Impuesto (por tasa: cada línea con la tasa de su {{item}})
= Total con impuesto
+ Cargos extras (fijos y en porcentaje sobre el total con impuesto, sin impuesto)
= TOTAL
```

Cada línea toma la tasa de impuesto de su {{item}} al agregarse (0% si el {{item}} es exento) y la
conserva aunque después cambie la tasa del {{item}}. El Estado del evento no influye en el impuesto.
El resumen muestra un renglón de impuesto por cada tasa. El depósito y el saldo se calculan sobre
ese TOTAL final.

## "Guardar borrador" vs "Crear cotización"

- **Guardar borrador**: guarda lo que haya cargado, sin exigir que esté completo. Alcanza con
  tener un cliente. La cotización queda en **Pendiente**, marcada como borrador.
- **Crear cotización**: exige cliente, Estado, Ciudad, Dirección y al menos una línea. Saca la
  marca de "borrador", pero la cotización **sigue en Pendiente** — todavía no es lo mismo que
  enviarla al cliente. Ese paso está en
  [Cómo enviar una cotización al cliente y generar el PDF](/admin/settings/support/enviar-una-cotizacion).

Ninguno de los dos botones manda un email o WhatsApp automático al cliente.
