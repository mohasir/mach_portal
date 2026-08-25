# Styling Guide — Mach Portal

Stack: **AntD v6 · Tailwind v4**

---

## Arquitectura de estilos

La regla principal: **AntD para componentes y layout, Tailwind para lo que AntD no cubre o para forzar overrides**.

```
AntD token system (antd.ts)
  └── cssVar { key: '_,:root,mb-theme' }
        └── genera --ant-color-* en :root
              └── globals.css @theme mapea → clases Tailwind
```

No usar CSS modules. No usar inline styles. No hardcodear colores hex en componentes.

---

## Token system

### Fuente de verdad

`src/lib/theme/antd.ts` — contiene el objeto `MB` con todos los colores de marca y el `machBarTheme` para AntD.

### Cómo fluyen los tokens

**AntD tokens** → AntD genera `--ant-color-primary`, `--ant-border-radius`, etc. en `:root` → Tailwind los mapea en `@theme`:

| CSS var AntD                 | Clase Tailwind                | Uso                                |
| ---------------------------- | ----------------------------- | ---------------------------------- |
| `--ant-color-primary`        | `bg-primary` / `text-primary` | Verde oliva — acciones principales |
| `--ant-color-text`           | `text-foreground`             | Texto base                         |
| `--ant-color-text-secondary` | `text-muted`                  | Texto secundario                   |
| `--ant-color-bg-layout`      | `bg-background`               | Fondo de página                    |
| `--ant-color-bg-container`   | `bg-surface`                  | Fondo de cards/inputs              |
| `--ant-color-border`         | `border-line`                 | Bordes                             |
| `--ant-color-error`          | `text-error` / `bg-error`     | Errores                            |

**Colores de marca** (no cubiertos por AntD) — definidos directamente en `@theme`:

| Clase Tailwind                | Valor     | Uso                  |
| ----------------------------- | --------- | -------------------- |
| `text-brown` / `bg-brown`     | `#4a2c2a` | Headings, nav dark   |
| `text-mustard` / `bg-mustard` | `#dacd6b` | Highlight, accent    |
| `bg-ivory`                    | `#f7eed2` | Cotizaciones, quotes |
| `text-salmon`                 | `#f28a86` | Alertas, warnings    |
| `bg-olive-faint`              | `#f4f4e8` | Fondos sutiles       |

---

## Tipografía

### Fuentes

- **Work Sans** — body y UI. Default en toda la app vía `--font-sans`.
- **Marcellus** — headings editoriales. Clase `font-heading`.

Las fuentes usan Next.js font optimization — no importar desde Google Fonts directamente.

### Typography.Title

`level` mapea a HTML heading y tamaño:

| `level` | HTML   | Tamaño | Color        |
| ------- | ------ | ------ | ------------ |
| `1`     | `<h1>` | 28px   | brown (auto) |
| `2`     | `<h2>` | 22px   | brown (auto) |
| `3`     | `<h3>` | 16px   | brown (auto) |
| `4`     | `<h4>` | 14px   | brown (auto) |
| `5`     | `<h5>` | 13px   | brown (auto) |

`colorTextHeading` está mapeado a `MB.brown` — el color es automático. Para Marcellus agregá `font-heading!`:

```tsx
<Typography.Title level={1} className="font-heading!">
  Título
</Typography.Title>
```

### Typography.Text — variantes semánticas (props AntD)

```tsx
<Typography.Text type="secondary">muted</Typography.Text>   // usa colorTextSecondary = MB.muted
<Typography.Text type="danger">error</Typography.Text>
<Typography.Text type="warning">warning</Typography.Text>
<Typography.Text type="success">success</Typography.Text>
<Typography.Text strong>bold</Typography.Text>
```

### Clases Tailwind del UI kit

```tsx
<span className="text-label">FIELD LABEL</span>    // 10px / 600 / uppercase
<span className="text-small">timestamp</span>       // 11px
<span className="text-caption">hint</span>          // 9px / muted
<span className="text-base font-medium">Body large</span>  // 16px / 500
```

---

## Layout

Preferir componentes AntD antes de divs con Tailwind:

| Necesidad                 | Usar                                           |
| ------------------------- | ---------------------------------------------- |
| Flex layout               | `<Flex justify="..." align="...">`             |
| Grid / columnas           | `<Row> <Col span={12}>`                        |
| Card con borde            | `<Card>` — borde y fondo del tema automático   |
| Espaciado entre elementos | `<Space size="...">`                           |
| Divider                   | `<Divider>`                                    |
| Texto                     | `<Typography.Text>` / `<Typography.Paragraph>` |

Tailwind para lo que AntD no tiene prop nativa:

```tsx
// min-height no existe en Flex como prop
<Flex justify="center" className="min-h-screen">

// max-width en Card
<Card className="w-full max-w-90">

// padding interno de Card
<Card classNames={{ body: 'p-8' }}>
```

---

## Iconos

**Todos los iconos vienen de `lucide-react` por defecto.** Prohibido `@ant-design/icons` (removido del proyecto) y cualquier otra librería de iconos o SVG inline sueltos.

**Excepción: `react-icons`** — instalado (`apps/web`) para los casos puntuales en que un ícono de
lucide no se ajusta a lo que el usuario busca. Se usa **solo a pedido explícito** ("este ícono no
me gusta, probá con react-icons/..."), nunca como elección por defecto ni a iniciativa propia — si
lucide tiene un ícono razonable para el caso, se usa ese. Mismas reglas de `size`/color que lucide
(los sets de `react-icons` también soportan `size` y heredan color por `currentColor`/`fill`, según
el set — revisar el ícono puntual).

```tsx
import { Menu, Bell, LogOut } from 'lucide-react';
```

- **Naming:** PascalCase, sin sufijo `Outlined` (`MenuOutlined` → `Menu`, `LogoutOutlined` → `LogOut`). Ver el catálogo en [lucide.dev/icons](https://lucide.dev/icons).
- **Color:** lucide usa `stroke="currentColor"`, igual que AntD. Heredan el color del contenedor — usá clases `text-*` (`text-muted`, `text-primary`, …), nunca la prop `color` con hex.
- **Tamaño:** lucide viene a `24px` por defecto (AntD sizaba por `font-size`). Pasá siempre `size` explícito según contexto:

  | Contexto                        | `size` |
  | ------------------------------- | ------ |
  | Botones de acción, nav, avatar  | `18`   |
  | Inline en menús / dropdowns     | `16`   |
  | Micro (junto a texto `text-xs`) | `14`   |

- **Con componentes AntD:** se pasan como `ReactNode` en la prop `icon` (Button, Menu items, Avatar) o `prefix` (Input):

```tsx
<Button type="text" icon={<Menu size={18} />} />
<Avatar icon={<User size={18} />} />
```

El mapa de iconos de navegación vive en `src/lib/navigation/constants/icons.tsx` (`IconMap`).

---

## Fechas

**Toda fecha mostrada al usuario se formatea con `dayjs`** a través del helper central `src/lib/date`. Prohibido `toLocaleDateString`/`toLocaleString`, `Intl.DateTimeFormat` y armar formatos a mano (`${d}/${m}/${y}`). Se usa `dayjs` para centralizar en una sola lib de fechas, ya que AntD (`DatePicker`/`TimePicker`) ya la requiere nativamente.

El formateo es **locale-aware** (es/en) y se enlaza al idioma activo. En componentes usar el hook:

```tsx
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';

const { date, dateLong, dateTime, relative } = useDateFormatter();

date(note.createdAt); // "9 jul. 2026"
dateLong(new Date()); // "9 de julio de 2026"
dateTime(note.updatedAt); // "9 jul. 2026, 14:30"
relative(note.createdAt); // "hace 3 días"
```

Fuera de componentes (utils, loaders) usar las funciones puras de `src/lib/date`, pasando el locale explícito: `formatDate(value, locale)`.

- Acepta `Date | string | number` (las fechas de la API llegan como ISO string y se parsean solas).
- Elegir la variante por contexto: `date` (media), `dateLong` (larga/editorial), `dateTime` (con hora), `relative` (relativa). Para un formato nuevo, agregar una función al helper — no formatear inline en el componente.

---

## Overrides de estilos AntD

`AntdRegistry layer` (en `layout.tsx`) envuelve todos los estilos de AntD en `@layer antd`. `globals.css` declara el orden `@layer theme, base, antd, components, utilities`, por lo que **`components` y `utilities` siempre le ganan a `antd`** — por eso las clases Tailwind sobre componentes AntD funcionan sin `!`.

Escala de menor a mayor intrusión. **Usá siempre el primer nivel que resuelva el caso:**

**1. Clase Tailwind en el componente** (preferido) — para el elemento raíz:

```tsx
<Typography.Title level={2} className="font-heading text-brown mb-6">
<Form.Item className="mb-0">
<Button className="mt-2 text-muted">
```

**2. `classNames` / `styles` semánticos** cuando el ajuste va a una parte interna que AntD expone como slot (`body` de Card/Drawer, `icon`/`content` de Button, etc.). Preferir clases Tailwind dentro de `classNames`:

```tsx
<Card classNames={{ body: 'p-4 md:p-8' }}>
<Drawer classNames={{ body: 'p-0!' }}>
```

**3. Regla global en `globals.css` → `@layer components`** cuando hay que tocar una clase interna de AntD (`.ant-*`) que **no** se alcanza por props ni por `className`/`classNames` del componente, y el ajuste es **transversal** (aplica a todas las instancias). Es el único lugar permitido para escribir selectores `.ant-*` a mano:

```css
/* globals.css */
@layer components {
  /* Centrar iconos lucide (SVG) dentro de Button de AntD: resetIcon() de AntD
     le pone vertical-align:-0.125em al <svg> y el span .ant-btn-icon queda
     `inline` → descentra el icono. Volver el span flex-center lo arregla. */
  .ant-btn > .ant-btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}
```

Reglas del nivel 3:

- **Siempre** dentro de `@layer components` (nunca un selector suelto fuera de capa: rompe el orden y te obliga a `!`).
- **Comentá el porqué** — qué estilo de AntD estás neutralizando y su causa.
- Solo para arreglos **transversales/estructurales**. Un ajuste puntual de una instancia va por nivel 1 o 2.

El sufijo `!` (Tailwind v4) solo es necesario si se quiere ganarle a estilos fuera de cualquier layer (estilos inline o JS que AntD inyecte dinámicamente fuera del sistema de layers).

**Nunca** (en cualquier nivel): CSS modules, inline styles, ni colores hex hardcodeados — ver [Arquitectura de estilos](#arquitectura-de-estilos).

---

## Formularios

AntD Form nativo.

```tsx
const [form] = Form.useForm<MiTipo>();

<Form form={form} layout="vertical" onFinish={onFinish}>
  <Form.Item
    name="email"
    label="Email"
    rules={[
      { required: true, message: 'Campo requerido' },
      { type: 'email', message: 'Email inválido' },
    ]}
  >
    <Input />
  </Form.Item>
</Form>;
```

`rules` maneja validación en tiempo real: `required`, `type` (email, url, number), `min`, `max`, `pattern`, `validator` async.

---

## Notificaciones y mensajes

Usar `App.useApp()` — no los métodos estáticos de AntD:

```tsx
const { message, notification, modal } = App.useApp();

message.success('Guardado');
message.error('Error al guardar');
notification.open({ message: 'Título', description: '...' });
modal.confirm({ title: '¿Eliminar?', onOk: () => {} });
```

Requiere que `<App>` esté en el árbol (ya está en `providers.tsx`).
