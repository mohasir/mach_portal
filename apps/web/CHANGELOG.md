# Changelog

Todos los cambios notables de Mach Portal (web) se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto usa [Semantic Versioning](https://semver.org/lang/es/).

## [0.2.0] - 2026-07-28

### Added

- Cargo por larga distancia editable en el builder de cotización, con sugerencia
  automática a partir de la tasa del estado seleccionado (editable siempre).
- Rediseño mobile del builder de cotización: secciones de Cliente, Detalle del
  evento, Dirección y Cargos extras agrupadas en cards independientes.
- Flujo de Cliente en mobile con bottom sheets para seleccionar/crear cliente,
  card resumen con avatar, y opción de "Cambiar" (editar o seleccionar otro).
- Nueva vista rápida de estaciones (`QuickLineBuilder`) en mobile: agrega
  estaciones en formato card sin tener que elegir ingrediente por ingrediente
  (se incluyen todas las opciones disponibles por defecto), con cantidad y
  precio editables desde un bottom sheet.
- Botón de compartir (`ShareButton`) en el detalle de cotización: comparte el
  PDF vía la hoja nativa del dispositivo cuando está disponible, o copia el
  enlace al portapapeles (con fallback manual para HTTP sin contexto seguro).
- Ícono de copiar enlace en el header del detalle de cotización.
- Componente reusable `PhoneInput` (selector de país + código de marcado) en
  los formularios de Clientes, Staff y Cliente nuevo (cotizaciones).
- Fondo de contenido configurable por página en el layout mobile (blanco por
  defecto, gris sutil en el builder de cotización).

### Changed

- Todos los `Form.Item` de la app ahora usan el componente `FieldLabel` para
  el label, de forma consistente.
- Botones, inputs, `InputNumber` y `DatePicker`/`TimePicker` ahora tienen 38px
  de alto (antes 32px); se quitó el padding vertical por defecto entre label y
  control en todos los formularios (`layout="vertical"`).
- El cliente de autenticación ahora usa el origin real del navegador en vez de
  una URL fija, para que el login funcione al entrar desde otro dispositivo en
  la misma red (no solo `localhost`).
- El PDF y la vista previa de la cotización ahora muestran el cargo por larga
  distancia y el impuesto como líneas separadas (antes el impuesto aparecía
  mal etiquetado como "Long Distance Travel Fee").
- El generador de keys internas de línea del builder de cotización dejó de
  depender de `crypto.randomUUID()` (fallaba en contextos no seguros, ej. HTTP
  sobre una IP de LAN al probar desde el celular) — ahora usa un fallback
  simple, ya que esas keys nunca viajan al servidor.

## [0.1.0] - 2026-07-22

### Added

- App instalable como PWA (manifest + service worker).
- Navegación mobile rediseñada: bottom nav + pantalla de Opciones.
- Topbar mobile con perfil de usuario.
