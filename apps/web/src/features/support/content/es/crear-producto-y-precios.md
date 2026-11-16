Los {{items}} (el nivel más alto del catálogo) se crean y editan desde `Catálogo`.

## Crear un {{item}}

Botón "Nuevo {{item}}" — pide Nombre (obligatorio, no puede repetirse), Descripción (opcional) y
el switch **Premium** (agrega una etiqueta dorada en la lista y el detalle; es solo cosmético, no
afecta precio ni disponibilidad en ningún otro lado de la app).

Este formulario **no carga precios** — el {{item}} se crea sin paquetes, y hay que entrar después al
detalle para agregarlos.

![Formulario "Nuevo {{item}}"](/support/crear-producto-y-precios/1.png)

## Cargar los precios (paquetes)

Entrá al detalle del {{item}} → pestaña **Precios**. Cada paquete = una cantidad de personas +
un precio total para esa cantidad (no es precio por persona).

- "Agregar paquete" suma una fila vacía; al tocar "Guardar" se **reemplazan todos los paquetes** de
  el {{item}} de una vez (no queda historial de los paquetes anteriores).
- No puede haber dos paquetes con la misma cantidad de personas — el sistema lo rechaza.
- Si intentás quitar una fila con datos cargados, pide confirmación; si está vacía, se quita
  directo.

![Tab Precios con los paquetes cargados](/support/crear-producto-y-precios/2.png)

Estos paquetes son los que después aparecen como desplegable al agregar el {{item}} a una
cotización — no se puede cargar una cantidad de personas que no exista como paquete.
