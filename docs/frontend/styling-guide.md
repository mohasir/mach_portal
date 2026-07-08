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

| CSS var AntD | Clase Tailwind | Uso |
|---|---|---|
| `--ant-color-primary` | `bg-primary` / `text-primary` | Verde oliva — acciones principales |
| `--ant-color-text` | `text-foreground` | Texto base |
| `--ant-color-text-secondary` | `text-muted` | Texto secundario |
| `--ant-color-bg-layout` | `bg-background` | Fondo de página |
| `--ant-color-bg-container` | `bg-surface` | Fondo de cards/inputs |
| `--ant-color-border` | `border-line` | Bordes |
| `--ant-color-error` | `text-error` / `bg-error` | Errores |

**Colores de marca** (no cubiertos por AntD) — definidos directamente en `@theme`:

| Clase Tailwind | Valor | Uso |
|---|---|---|
| `text-brown` / `bg-brown` | `#4a2c2a` | Headings, nav dark |
| `text-mustard` / `bg-mustard` | `#dacd6b` | Highlight, accent |
| `bg-ivory` | `#f7eed2` | Cotizaciones, quotes |
| `text-salmon` | `#f28a86` | Alertas, warnings |
| `bg-olive-faint` | `#f4f4e8` | Fondos sutiles |

---

## Tipografía

### Fuentes
- **Work Sans** — body y UI. Default en toda la app vía `--font-sans`.
- **Marcellus** — headings editoriales. Clase `font-heading`.

Las fuentes usan Next.js font optimization — no importar desde Google Fonts directamente.

### Typography.Title
`level` mapea a HTML heading y tamaño:

| `level` | HTML | Tamaño | Color |
|---|---|---|---|
| `1` | `<h1>` | 28px | brown (auto) |
| `2` | `<h2>` | 22px | brown (auto) |
| `3` | `<h3>` | 16px | brown (auto) |
| `4` | `<h4>` | 14px | brown (auto) |
| `5` | `<h5>` | 13px | brown (auto) |

`colorTextHeading` está mapeado a `MB.brown` — el color es automático. Para Marcellus agregá `font-heading!`:

```tsx
<Typography.Title level={1} className="font-heading!">Título</Typography.Title>
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

| Necesidad | Usar |
|---|---|
| Flex layout | `<Flex justify="..." align="...">` |
| Grid / columnas | `<Row> <Col span={12}>` |
| Card con borde | `<Card>` — borde y fondo del tema automático |
| Espaciado entre elementos | `<Space size="...">` |
| Divider | `<Divider>` |
| Texto | `<Typography.Text>` / `<Typography.Paragraph>` |

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

## Overrides con Tailwind

`AntdRegistry layer` (en `layout.tsx`) envuelve todos los estilos de AntD en `@layer antd`. La declaración `@layer antd, utilities` en `globals.css` establece que `utilities` gana sobre `antd`. Por esto las clases Tailwind sobre componentes AntD funcionan sin `!`:

```tsx
<Typography.Title level={2} className="font-heading text-brown mb-6">
<Form.Item className="mb-0">
<Button className="mt-2 text-muted">
```

El sufijo `!` (Tailwind v4) solo es necesario si se quiere ganarle a estilos fuera de cualquier layer (estilos inline o JS que AntD inyecte dinámicamente fuera del sistema de layers).

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
</Form>
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
