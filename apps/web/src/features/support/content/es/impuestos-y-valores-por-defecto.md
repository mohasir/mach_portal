`Configuración → General` (rol Admin) tiene dos tarjetas relacionadas con las cotizaciones.

## Valores por defecto de cotizaciones

Depósito por defecto (%), Validez de la cotización (meses — de esto depende la fecha de
vencimiento), Inicio de consecutivo de cotización, Moneda y Fecha límite para elegir opciones (días
antes del evento). La cantidad mínima de cada línea se define en cada elemento del catálogo.

> El inicio de consecutivo **no se puede bajar** por debajo del último número ya usado — cualquier
> intento en ese sentido se rechaza.

![Tarjeta de valores por defecto de cotizaciones](/support/impuestos-y-valores-por-defecto/1.png)

## Impuestos

El impuesto es de cada {{item}}, no del lugar del evento. La tarjeta **Impuestos** tiene la **tasa
de impuesto por defecto**: es la tasa con la que nace cada {{item}} nuevo.

- En cada {{item}} del catálogo se puede cambiar su tasa o marcarlo **exento de impuesto** (se
  cotiza al 0%, sin perder la tasa cargada).
- Cambiar la tasa por defecto no modifica los {{items}} que ya existen.
- Cada línea de una cotización copia la tasa de su {{item}} al agregarse y la conserva: cambiar la
  tasa de un {{item}} solo afecta a las líneas nuevas o editadas.
- Una cotización puede tener líneas con tasas distintas; el resumen y el PDF muestran el impuesto
  de cada tasa por separado.

## Cargos adicionales

Con el add-on de cargos adicionales, la sección **Cargos adicionales** del menú define los cargos
que se pueden sumar a una cotización (por ejemplo un traslado o un recargo por pago con tarjeta):
nombre, fijo o en porcentaje, y valor por defecto. Un cargo en porcentaje se calcula sobre el total
con impuesto y ningún cargo paga impuesto. Desactivar un cargo lo saca del armador; las cotizaciones
que ya lo tienen lo conservan.

## Importante: esto no toca las cotizaciones ya existentes

Cambiar cualquiera de estos valores **solo afecta a las cotizaciones que se creen o editen
después**. Las que ya existen conservan las tasas, cargos y valores que tenían al guardarse — no se
recalculan solas.
