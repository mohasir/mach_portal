# Catálogo genérico (productos o servicios): programa y decisiones

Estado (2026-11-17): **las tres fases están terminadas e integradas en `multitenant`** (merges `--no-ff`, el último `592fe49`). Lo que sigue del multi-tenant es la fase 4b; ver `docs/superpowers/handoffs/2026-11-17-multitenant-fase-4b.md`.

Programa original: **programa de tres fases**. Este documento recoge las decisiones comunes y el reparto; cada fase tiene su propio spec (`docs/superpowers/specs/YYYY-MM-DD-<fase>-design.md`), su plan y **su propia rama, creada desde `multitenant` cuando la fase anterior ya está integrada** (así no hay ramas apiladas).

| Fase | Rama | Contenido |
|---|---|---|
| **1. Catálogo genérico** | `feat/catalogo-generico` | Productos o servicios por organización y textos, imágenes en lugar de iconos, campos nuevos del producto (SKU, costo, unidad de medida, cantidad mínima), módulos de Unidades de medida y de Categorías, limpieza de seeds y PDF |
| **2. Impuesto por línea** | `feat/impuesto-por-linea` | Tasa por defecto de la organización, tasa y exento por producto, cálculo de totales por línea y descuento repartido; elimina el impuesto por estado |
| **3. Ubicación de operación** | `feat/ubicacion-operacion` | Configuración con formulario, datasets de EE. UU. y Nicaragua, país y ciudad en cotización y evento, migración desde `NY/NJ/CT` |

Orden: 1 → 2 → 3. La 2 necesita los campos del producto de la 1; la 3 reemplaza el campo `state`, que tras la 2 ya no se usa para impuestos.

## 1. Objetivo

El producto nació para un cliente que vendía "estaciones" de comida para eventos. Para que otros tipos de negocio lo usen, nada de la interfaz, el código ni los datos puede quedar atado a ese cliente. La base de datos y la API ya son genéricas (`products`, `option_groups`, `options`); el rastro del cliente está en los textos, en los iconos y emojis elegidos por nombre de producto, en los estados `NY/NJ/CT` y en los seeds.

## 2. Decisiones tomadas

- **Productos o servicios:** cada organización vende una de las dos cosas (no ambas, por ahora). Lo define el **admin de plataforma** (con un comando; más adelante, el onboarding), no la organización.
  - **Dónde se guarda:** tabla `tenant_profile` (configuración de la organización definida por la plataforma; RLS de solo lectura para la API, como `tenant_features`; no va en `app_settings` porque esa la edita la organización). Hoy tiene una columna, `catalog_kind` (texto, **un solo valor**), validada contra un registro en código, no un enum de la base de datos. Pasar a una lista de tipos más adelante es una migración de una línea.
  - **Registro de tipos de catálogo en código** (como el de features): `products` y `services` hoy; agregar un tipo es sumar una entrada con su **vocabulario** por idioma (singular y plural, con y sin mayúscula).
  - **Textos centralizados:** un hook `useCatalogVocabulary()` devuelve las palabras ya resueltas y todos los textos afectados usan interpolación (`"Nuevo {{item}}"`); ninguna pantalla sabe qué tipo hay. Los diccionarios viven en un solo archivo de traducción por idioma. Con varios tipos (futuro) el hook devolvería un vocabulario neutro sin tocar las pantallas. Combinar tipos pediría además saber de qué tipo es cada producto, y eso se diseña cuando llegue.
  - "Estaciones" pasa a "Productos" o "Servicios" según la organización. "Sección" e "Ítem" (grupos y opciones) se quedan.
- **Iconos e imágenes:** se elimina la elección de iconos por nombre de producto (`getStationIcon`, el mapa de emojis del PDF). Cada producto lleva una **galería de hasta 5 imágenes** y una de ellas es la **imagen destacada**; sin imágenes se muestra un marcador neutro. El máximo es una constante (`PRODUCT_IMAGES_MAX = 5`), ampliable después.
  - **Tabla `product_images`** (con `tenant_id` y RLS, borrado en cascada con el producto): `image_key`, `image_url`, `thumb_key`, `thumb_url` (misma convención `key` + `url` que los adjuntos de pago y los PDF de cotización), nombre original, tamaño, ancho y alto, `sort_order`, `is_featured` (índice único parcial: una destacada por producto) y creador y fecha. Los archivos viven en R2, no en la base de datos.
  - **Subida** por una ruta Express (como los comprobantes) con `multer` en memoria, JPG/PNG/WebP de hasta 5 MB, en tres fases sin transacción abierta durante el procesamiento: (1) transacción corta que comprueba producto y máximo; (2) `sharp` valida que sea una imagen real (límite de píxeles), corrige la orientación, quita el EXIF y genera dos WebP (imagen de hasta 1600 px y miniatura de hasta 400 px) que se suben a `t/{tenantId}/products/{productId}/…`; (3) transacción corta que bloquea el producto, vuelve a comprobar el máximo y guarda la fila (destacada si es la primera), limpiando R2 si falla.
  - **Borrar:** la transacción elimina la fila y, confirmada, se borran los dos archivos de R2; si era la destacada, lo pasa a ser la siguiente. Destacar y reordenar son mutaciones tRPC.
  - **Despliegue:** `sharp` es nativa; hay que sumarla como dependencia y a los `--external` del `build` de esbuild de la API, y comprobar que el despliegue instala su binario. Se importa solo al subir, para que su ausencia no impida arrancar la API.
  - Las listas usan la miniatura de la destacada; el detalle y el PDF, la imagen.
- **Campos nuevos del producto:** imagen, SKU, costo (interno, nunca en la cotización), exento de impuesto, tasa de impuesto propia, unidad de medida (UoM) y cantidad mínima. `isPremium` se mantiene.
- **Módulos completos nuevos** (CRUD por organización, con permisos y entrada en el menú de Catálogo): **Unidades de medida** y **Categorías**. Cada producto elige una unidad; la categoría es opcional.
- **Unidad de cobro por producto** (persona, hora, unidad…). La cantidad de una línea se muestra en la unidad del producto. Los tramos de `priceTiers` pasan a ser tramos de cantidad en esa unidad.
- **Renombrado `numPersons` → `quantity` ahora** (decidido): columnas `num_persons` de `quote_lines` y `product_price_tiers`, API, esquemas, web, tests, seeds y docs (63 archivos, unas 308 apariciones). Es una tarea mecánica y separada, la primera de la fase 1, con su propia migración (`RENAME COLUMN`, que también renombra la restricción única de los tramos).
- **Mínimo por producto:** `minPersonsPerLine` deja de ser un ajuste global y pasa a ser un campo del producto, en su unidad.
- **Impuesto:** solo por producto y por línea. La organización define un **valor por defecto** (en Configuración); al crear un producto el campo se autocompleta con él y el admin puede cambiarlo. Las líneas exentas no pagan. **Se elimina por completo** el impuesto por estado (`applyTaxByState`, `state_settings` y el enum `NY/NJ/CT`).
- **"Estaciones" como nombre de add-on desaparece:** quedan "Precios por tramos" (`priceTiers`) y "Opciones configurables" (`configurableOptions`).
- **Ubicación de operación: es una configuración de la organización, no un add-on.** La activa el admin de la organización, no la plataforma. Indica dónde ofrece la organización sus productos o servicios, a nivel mundial.
  - En Configuración hay un interruptor. Al activarlo aparece un formulario y **no se guarda ni queda activa hasta completarlo**: si el formulario está incompleto, el cambio no se aplica y la función sigue apagada.
  - El formulario: elige **país**; por defecto se entiende que cubre todo el país, y una opción permite indicar que opera solo en ciertos estados o ciudades. Hasta **2 niveles** por país (por ejemplo, estado → ciudad).
  - Cada país define cómo se llama cada nivel y el formulario lo muestra con ese nombre (EE. UU.: estado, ciudad; Nicaragua: departamento, y su segundo nivel administrativo).
  - Una opción indica si la cotización debe **pedir dirección**. Esa dirección es la del servicio, no un método de entrega (el módulo de entregas queda fuera de alcance).
  - Apagada, la cotización no pide ubicación ni dirección; lo ya guardado se conserva y se sigue mostrando.
  - Fuente de datos: un dataset por país, creado a medida. Por ahora **EE. UU. y Nicaragua**; otro país se agrega cuando haya un cliente que lo necesite.

## 2.1 Unidades de medida (UoM): decisiones de la fase 1

Referencia: `GUIA_MODULO_UOM.md` (otro sistema, un ERP). De ahí se adopta el catálogo de unidades y la idea de grupos con conversión; se descartan los tipos de UoM, las varias unidades por producto con equivalencia, códigos de barras, medidas, listas de precio por unidad, inventario, proveedores y órdenes de compra, y la mecánica del sistema original (staging, SP, acciones ADD/UPDATE/DELETE). Los tipos de UoM y las unidades múltiples por producto son la extensión futura para inventario o POS.

- **Por organización:** cada organización tiene su propia copia de las unidades (como tipos de evento y motivos de reprogramación), tabla con `tenant_id` y RLS.
- **Tipos fijos del sistema** (enum `dimension`, sin tabla ni pantalla de grupos): Cantidad, Tiempo, Peso, Volumen, Longitud. Cada unidad guarda su `dimension` y un `factor` respecto a la unidad base de su tipo; una sola unidad base por tipo y organización (índice parcial único). Sin referencia circular grupo ↔ unidad.
- **Unidades iniciales (23)**, la base de cada tipo es la más pequeña para que los factores sean exactos:
  - Cantidad (base Unidad): Unidad `und` 1 · Persona `pers` 1 · Servicio `serv` 1 · Caja `caja` 1 · Par `par` 2 · Docena `doc` 12.
  - Tiempo (base Minuto): Minuto `min` 1 · Hora `h` 60 · Día `d` 1440 · Semana `sem` 10080.
  - Peso (base Gramo): Gramo `g` 1 · Kilogramo `kg` 1000 · Libra `lb` 453.59237 · Onza `oz` 28.349523125.
  - Volumen (base Mililitro): Mililitro `ml` 1 · Litro `l` 1000 · Onza líquida `fl oz` 29.5735295625 · Galón `gal` 3785.411784.
  - Longitud (base Milímetro): Milímetro `mm` 1 · Centímetro `cm` 10 · Metro `m` 1000 · Pulgada `in` 25.4 · Pie `ft` 304.8.
  - Persona, Servicio y Caja valen 1 respecto a Unidad: sirven para elegir el cobro, no para convertir. El contenido de una caja varía por producto y pertenece a la futura extensión de inventario. Día = 24 horas de calendario. No hay Mes (duración variable).
- **Reglas:** las iniciales llevan `isSystem` (no se borran ni cambian de tipo o factor; sí se renombran o desactivan). Las propias son editables, salvo tipo y factor cuando un producto las usa. Código único por organización, validado en el servicio. Un producto tiene **una** unidad (`products.uom_id`), la de su precio y su cantidad.
- **Cómo llega a producción:** una migración nueva crea la tabla, agrega `products.uom_id` y rellena a las organizaciones existentes (los productos existentes quedan con Persona); `seedUnitsOfMeasure(tenantId)` se suma a `seedTenantDefaults` para las organizaciones nuevas, el seed de producción y los de demo, de forma idempotente por código. La lista vive en un solo lugar del código y una prueba comprueba que la migración inserta lo mismo.

## 3. Observaciones y pendientes

- **Migración de datos del cliente original (a ver más adelante):** las cotizaciones y eventos existentes de ese cliente traen el campo `state` con `NY`, `NJ` o `CT`. Al reemplazar el enum por país y ciudad hay que convertirlos (país EE. UU., estado y ciudad desde la dirección ya guardada o dejando solo el estado) y definir qué se hace con las tasas de impuesto por estado que ya están congeladas en las cotizaciones. Hoy el cliente real de `main` no está migrado al esquema multi-tenant, así que esto afecta primero a la rama `multitenant` y a los datos de demo.
- **Cargo por larga distancia (`longDistanceAmount`):** también viene del cliente original y hoy entra en la base gravable. Hay que decidir si se conserva, con qué nombre y qué tasa lleva con el impuesto por línea.
- **Descuento de la cotización:** hoy se resta antes del impuesto. Con impuesto por línea hay que repartirlo proporcionalmente entre las líneas.
- **`promptRateChanges` y el aviso de tasas desactualizadas** (`quoteRateDrift`) nacieron para el impuesto por estado; hay que decidir qué queda de ellos.
- **Seeds y demo:** los nombres `Fruit Station` y `Snack Station` y el mapa de emojis del PDF (`quotes.pdf.ts`) se reemplazan por datos neutros.
