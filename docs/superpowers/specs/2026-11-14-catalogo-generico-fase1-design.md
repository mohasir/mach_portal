# Catálogo genérico, fase 1: productos o servicios, unidades, categorías e imágenes — diseño

Rama: `feat/catalogo-generico` (desde `multitenant`). Programa y decisiones comunes: `docs/superpowers/specs/2026-11-14-catalogo-generico-programa.md`. Referencia de unidades de medida: `GUIA_MODULO_UOM.md` (otro sistema; solo se adopta lo indicado en el programa §2.1).

## 1. Objetivo y alcance

El producto nació para un cliente que vendía "estaciones" de comida para eventos. Esta fase quita ese rastro de la interfaz, el código y los datos, y completa el catálogo para que lo use cualquier tipo de negocio.

**Incluye:**
- Renombrar `numPersons` / `num_persons` a `quantity`.
- Tipo de catálogo por organización (productos o servicios), definido por la plataforma, y los textos que dependen de él.
- Módulo de **unidades de medida** (UoM) por organización, con lista inicial.
- Módulo de **categorías**.
- Campos nuevos del producto: unidad, categoría, SKU, costo, cantidad mínima.
- **Galería de imágenes** por producto (hasta 5) con imagen destacada y miniatura; fin de los iconos y emojis elegidos por nombre.
- Limpieza de seeds, demo, PDF y documentación del dominio.

**No incluye:** el impuesto por línea y el exento por producto (fase 2); la ubicación de operación y la migración de `NY/NJ/CT` (fase 3); inventario, POS, tipos de UoM, varias unidades por producto y empaque (extensión futura); catálogos mixtos (productos y servicios a la vez); onboarding; mostrar imágenes en el PDF (depende del servicio de PDF, externo; a verificar).

## 2. Renombrado `numPersons` → `quantity`

- Columnas: `quote_lines.num_persons` y `product_price_tiers.num_persons` pasan a `quantity`; la restricción única de los tramos (`product_price_tiers_product_persons_unique`) se renombra. Migración con `RENAME COLUMN`, que no mueve datos.
- Código: esquemas Zod, repositories, services, resources, validación de líneas (`changedLines`), seeds, web y tests: 63 archivos, unas 308 apariciones. El payload al servicio de PDF ya usa `quantity`.
- Es la primera tarea y va aislada: sin cambios de comportamiento; la verificación es que toda la batería de pruebas pase igual.
- `minPersonsPerLine` no se renombra: desaparece en §6.

## 3. Tipo de catálogo (productos o servicios)

- **Tabla `tenant_profile`** (PK `tenant_id`): configuración de la organización definida por la **plataforma**. RLS igual que `tenant_features`: la API la lee (política `SELECT` por `tenant_id`) y solo el rol `platform` escribe. No va en `app_settings`, que edita la organización. Hoy una columna, `catalog_kind` (texto, un solo valor), validada contra el registro; una organización sin fila usa `products`. Migración: las organizaciones existentes reciben `products`.
- **Registro en código** (`@repo/guards` o `@repo/schemas`, junto a los demás registros): `CATALOG_KINDS = { products, services }`. Cada entrada define su vocabulario por idioma: sustantivo en singular y plural, con y sin mayúscula inicial. Agregar un tipo es sumar una entrada y sus palabras; no requiere migración.
- **Comando** `tenant:set-catalog-kind --tenant <slug> --kind <products|services>` sobre el rol `platform` (patrón de `feature:set`), y `--catalog-kind` opcional en `tenant:create`.
- **API:** consulta nueva `tenant.profile` por la cadena normal del tenant (con la transacción de la petición, porque `tenant_profile` tiene RLS y el resolvedor de la organización corre sin ella); devuelve `{ catalogKind }`. La web la lee como `features.mine` (clave por organización, `staleTime` de 30 s).
- **Web:** hook `useCatalogVocabulary()` devuelve las palabras ya resueltas (`item`, `items`, `Item`, `Items`). Los textos afectados pasan a interpolación (`"Nuevo {{item}}"`); ninguna pantalla conoce el tipo. Los diccionarios viven en un solo archivo de traducción por idioma. Con varios tipos (futuro) el hook devolvería un vocabulario neutro sin tocar las pantallas.
- **Textos a reemplazar:** unas 38 líneas por idioma en nueve archivos de traducción (`catalog`, `roles`, `support`, `quotes`, `settings`, `api`, `admin`, `dashboard`, `events`). "Sección" e "Ítem" (grupos y opciones) se quedan. Los componentes `Station*` del detalle de eventos (`StationSheetHeader`, `StationSelectionDetailSheet`, `StationSelectionsSheet`) y las variables `station…` del código se renombran a términos de producto.

## 4. Unidades de medida (UoM)

Detalle y lista inicial en el programa §2.1. Resumen de diseño:

- **Tabla `units_of_measure`** (`tenant_id` + RLS `FOR ALL`): nombre, `plural_name` (para mostrar "40 personas", "3 horas"; la abreviatura no se pluraliza), código (abreviatura, único por organización), `dimension` (enum: `quantity`, `time`, `weight`, `volume`, `length`), `factor` (`numeric(24,10)` respecto a la unidad base de su tipo), `is_base`, `is_system`, `is_active`, `sort_order`. Índice parcial único: una sola unidad base por (organización, dimensión). Sin tabla de tipos ni de grupos; sin referencia circular.
- **Reglas** (en el servicio, con errores de dominio): código único; las unidades `is_system` no se borran ni cambian de dimensión o factor (sí se renombran o desactivan); en las propias, dimensión y factor no se cambian si algún producto las usa; la base de cada dimensión es siempre `factor = 1`; no se puede desactivar una unidad en uso por productos activos.
- **`products.uom_id`** (FK, `NOT NULL`): la unidad de cobro y de cantidad del producto.
- **Plurales de la lista inicial:** Unidades, Personas, Servicios, Cajas, Pares, Docenas, Minutos, Horas, Días, Semanas, Gramos, Kilogramos, Libras, Onzas, Mililitros, Litros, Onzas líquidas, Galones, Milímetros, Centímetros, Metros, Pulgadas, Pies. La lista (con singular, plural, código, dimensión y factor) es una constante `SYSTEM_UNITS` en `@repo/schemas`, de la que leen el seed y la prueba de la migración.
- **Lista inicial (23 unidades)**: en `seedUnitsOfMeasure(tenantId)`, sumada a `seedTenantDefaults` (organizaciones nuevas, seed de producción y demo, idempotente por código). La lista vive en un solo lugar del código.
- **Migración**: crea la tabla, rellena a **todas** las organizaciones existentes con la lista, agrega `products.uom_id` y asigna "Persona" a los productos existentes. Una prueba comprueba que el SQL de la migración inserta la misma lista que el código.
- **Módulo completo** (patrón `resource → repository → service → router`, `docs/backend/architecture.md`): `modules/unitsOfMeasure`, router `unitsOfMeasure` con `list`, `create`, `update`, `disable`/`enable`. Recurso de permisos nuevo (`unit_of_measure`) con acciones de lectura, creación, edición y desactivación, en la matriz y las plantillas de rol (los roles que hoy administran el catálogo lo reciben). Pantalla nueva bajo Catálogo (`DataTable` + tarjeta en móvil, formulario en modal), con el tipo como columna y el factor visible solo en unidades no base.
- **Dónde se muestra la unidad:** cantidad de las líneas de cotización y evento ("40 personas", "3 horas"), tramos de precio y selector de producto. Plurales y abreviaturas desde la unidad; el texto "personas" deja de existir.

## 5. Categorías y campos del producto

- **Tabla `product_categories`** (`tenant_id` + RLS): nombre (único por organización), `is_active`, `sort_order`. Lista plana, sin jerarquía. Módulo completo como unidades: `modules/productCategories`, recurso `product_category`, pantalla bajo Catálogo. `products.category_id` opcional (FK, `ON DELETE RESTRICT`; una categoría con productos solo se desactiva). Se puede filtrar el catálogo por categoría.
- **Campos del producto** (migración): `sku` (texto opcional, único por organización cuando existe), `cost` (centavos, opcional), `min_quantity` (entero ≥ 1, por producto, en su unidad; por defecto 1), `uom_id` y `category_id`. `isPremium` se mantiene.
- **Costo:** dato interno sensible. Lo ve y lo edita solo quien tenga el permiso nuevo `product_cost` (recurso `product_cost`, acciones `read` y `update`). Sin permiso, la API omite el campo en las respuestas (no solo lo oculta la web) y rechaza escribirlo. Nunca aparece en cotizaciones, eventos ni PDF.
- **Cantidad mínima:** pasa a ser del producto. La migración copia a cada producto existente el valor actual de `app_settings.min_persons_per_line` de su organización y luego se elimina esa columna, su campo en `@repo/schemas`, el recurso de configuración y el control de Configuración. La validación de líneas (`validateLine`) y el cotizador usan `product.min_quantity`.
- Impuesto (tasa por defecto, tasa y exento por producto): **fase 2**.

## 6. Imágenes

Diseño completo en el programa §2 (viñeta "Iconos e imágenes"). Resumen:

- **Tabla `product_images`** (`tenant_id` + RLS, cascada con el producto): `image_key`, `image_url`, `thumb_key`, `thumb_url`, nombre, tamaño, ancho, alto, `sort_order`, `is_featured` (índice único parcial: una destacada por producto), creador y fecha. Máximo `PRODUCT_IMAGES_MAX = 5` (constante en `@repo/schemas`), validado en el servidor con el producto bloqueado.
- **Subida**: ruta Express `POST` bajo el recurso `product` (acción de actualizar), `multer` en memoria, JPG/PNG/WebP de hasta 5 MB. Tres fases, sin transacción abierta mientras se procesa: (1) transacción corta que comprueba producto y máximo; (2) `sharp` valida que sea una imagen real (límite de píxeles), corrige la orientación, quita EXIF y genera dos WebP (imagen de hasta 1600 px, miniatura de hasta 400 px) que se suben a R2 en `t/{tenantId}/products/{productId}/…`; (3) transacción corta que bloquea el producto, vuelve a comprobar el máximo y guarda la fila (destacada si es la primera), borrando de R2 lo subido si falla. `guardTenantSession` aplica el permiso y el módulo igual que en los comprobantes.
- **Destacar, reordenar y borrar**: mutaciones tRPC. Borrar elimina la fila y, confirmada la transacción, los dos archivos de R2; si era la destacada, pasa a serlo la siguiente.
- **Lectura**: el producto devuelve `images[]` con `imageUrl`, `thumbUrl`, `isFeatured` y `sortOrder`; las listas usan la miniatura de la destacada. Sin imágenes, un marcador neutro (icono genérico de la librería, sin lógica por nombre).
- **Web**: componente de galería (AntD `Upload`, mobile-first) en el detalle del producto: subir, destacar, reordenar y borrar, con el contador `n/5`. Se eliminan `getStationIcon` y `STATION_ICON_RULES`.
- **Despliegue**: `sharp` como dependencia y en los `--external` del `build` de esbuild; se importa al subir, de modo que su ausencia no impide arrancar la API. Hay que comprobar que el despliegue instala su binario.
- `StorageProvider` no cambia. Los archivos viven en R2, no en la base de datos.

## 7. Limpieza del rastro del cliente

- **PDF** (`modules/quotes/quotes.pdf.ts`): se elimina el mapa de emojis por nombre de producto (`'Snack Station'`, `'Fruit Station'`) y sus comentarios; el PDF no depende de nombres.
- **Seeds**: los productos de demo y de catálogo base dejan de llamarse `Fruit Station` y `Snack Station` y se reemplazan por datos neutros (con unidad, y con tramos y opciones donde la demo los use); `db/seeds/quotePdfTemplate.ts` (`'Snack Stations'`), `demo.ts` (nombres traducidos) y `quotes.ts` se actualizan. Las organizaciones de demo conservan todas las features activas.
- **Documentación**: `docs/mach-bar-domain.md` (que describe el dominio del cliente original) conserva su historia, con una nota que remite al catálogo genérico; las arquitecturas de backend y frontend documentan los módulos nuevos, el vocabulario y la regla de no atar nombres al cliente.

## 8. Orden de entrega (tareas)

1. Renombrado `numPersons` → `quantity` (migración `RENAME COLUMN`; toda la batería sin cambios de comportamiento).
2. `tenant_profile`, registro de tipos de catálogo, comando `tenant:set-catalog-kind`, hook de vocabulario y reemplazo de los textos "estación" (incluye renombrar los componentes `Station*`).
3. Unidades de medida: tabla, migración con relleno, seed, módulo, permisos, pantalla, `products.uom_id` y la unidad en cantidades y tramos.
4. Categorías y campos del producto: tabla, módulo, SKU, costo con permiso, cantidad mínima por producto y retirada de `minPersonsPerLine`.
5. Imágenes: `product_images`, ruta de subida con `sharp`, mutaciones, galería web, retirada de iconos y emojis.
6. Seeds, demo y documentación.

Cada tarea termina con pruebas y `check-types`; los commits se separan por capa como en la fase 4a.

## 9. Pruebas

- **Renombrado**: la batería existente en verde sin cambios de aserciones (salvo el nombre del campo).
- **Tipo de catálogo**: RLS de `tenant_profile` (la API lee lo suyo y no escribe; la plataforma escribe), validación contra el registro, comando, y pruebas del vocabulario (productos y servicios, singular y plural, es y en) y de que ningún texto afectado queda sin su clave.
- **Unidades**: unicidad de código, una base por dimensión, reglas de `is_system` y de unidades en uso, aislamiento entre organizaciones, seed idempotente, igualdad entre el SQL de la migración y la lista del código, y la conversión exacta de los factores definidos.
- **Categorías y campos**: unicidad de SKU y de nombre, `ON DELETE RESTRICT`, el costo ausente de las respuestas sin permiso y rechazado al escribir sin permiso, la migración de `min_persons_per_line` a `min_quantity`, y la validación de línea con el mínimo del producto.
- **Imágenes**: máximo de 5 (también con subidas simultáneas), una sola destacada, archivos que no son imagen o con demasiados píxeles, limpieza de R2 cuando falla la fase 3, promoción de la destacada al borrar, aislamiento entre organizaciones, y el proveedor de almacenamiento simulado con imágenes generadas en la prueba.
- **Web**: helpers puros con pruebas para vocabulario, formato de cantidad con unidad y plural, visibilidad del costo por permiso y estado de la galería.

## 10. Riesgos y notas

- El renombrado y la retirada de `minPersonsPerLine` tocan muchos archivos: por eso van como tareas separadas y revisables.
- `sharp` es una dependencia nativa: riesgo de despliegue acotado por la importación diferida.
- Las URLs de imágenes se guardan junto con la clave (convención de los adjuntos y los PDF): si cambia el dominio público de R2 quedan viejas, como ya ocurre con esas tablas; un arreglo global sería una tarea aparte.
- Lo que decidí por mi cuenta, para tu revisión: SKU único y opcional; categorías planas; costo con permiso propio y omitido de las respuestas; cantidad mínima por producto con migración del valor actual; un producto existente queda con la unidad "Persona"; tope de 5 MB por archivo subido.
- Pendiente de fases siguientes: impuesto por línea (fase 2); ubicación de operación y migración de `NY/NJ/CT` (fase 3, ver observaciones del programa §3).
