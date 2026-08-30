Todo el manejo de pagos se hace desde la pestaña "Pagos" de la ficha del evento.

![Registrar un pago](/support/registrar-pagos-de-un-evento/1.png)

## Registrar un pago

Arriba aparecen **Pagado**, **Saldo** y **Total**, con el botón "Registrar pago" (deshabilitado
si el saldo ya está en 0). El formulario pide:

- **Método** (obligatorio): Zelle, Efectivo, Tarjeta, Cheque o Transferencia.
- Atajos de **porcentaje** (20/30/40/50%) que precalculan el monto sobre el total, con tope en el
  saldo disponible.
- **Monto** (obligatorio, no puede superar el saldo pendiente).
- **Fecha** (obligatorio, por defecto hoy), **Referencia** y **Notas** (opcionales).

Si el monto ingresado **supera el saldo pendiente**, el sistema rechaza toda la operación — no se
registra ni siquiera parcialmente. La suma de todos los pagos nunca puede superar el total.

## Comprobantes

Cada pago puede llevar un comprobante adjunto (botón "Comprobante" en su fila del histórico):
imagen (jpg/png/webp) o PDF, **hasta 5MB**. Todos los comprobantes de un evento también se ven
juntos en la pestaña "Adjuntos", ordenados por fecha de subida.

![Pestaña Adjuntos con los comprobantes](/support/registrar-pagos-de-un-evento/2.png)

## Qué no se puede hacer

- **No se puede editar ni borrar un pago ya registrado** — solo se pueden borrar sus comprobantes.
  Si se cargó un pago por error, no hay forma de corregirlo desde la interfaz.
- El estado de pago (**Pendiente**, **Parcial**, **Pagado**) se calcula solo, no se puede forzar.
