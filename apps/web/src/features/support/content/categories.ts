import {
  Calendar,
  CalendarCog,
  CalendarDays,
  ChefHat,
  Package,
  ReceiptText,
  Settings,
  Smartphone,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { ACTIONS, RESOURCES, type PermissionCheck } from '@repo/guards';

export interface HelpArticleEntry {
  slug: string;
  /** Omitted = informational, visible to anyone who can see the category (e.g. "what does X mean"). */
  guard?: PermissionCheck;
  /** ISO date (YYYY-MM-DD) of the last content edit. */
  updatedAt: string;
}

export interface HelpCategoryEntry {
  slug: string;
  icon: LucideIcon;
  articles: HelpArticleEntry[];
}

const { CREATE, READ, UPDATE, MANAGE_SELECTIONS, VIEW } = ACTIONS;

const LAST_CONTENT_PASS = '2026-08-30';

// Order here is the display order in the list. Labels/titles live in
// locales/{es,en}/support.json (categories.<slug>.label / articles.<slug>.title), not here.
// Icons mirror the ones already used for these features in the main nav (see
// lib/navigation/constants/icons.tsx) so they read as the same concept.
export const HELP_CATEGORIES: HelpCategoryEntry[] = [
  {
    slug: 'cotizaciones',
    icon: ReceiptText,
    articles: [
      {
        slug: 'crear-una-cotizacion',
        guard: { [RESOURCES.QUOTE]: [CREATE] },
        updatedAt: LAST_CONTENT_PASS,
      },
      {
        slug: 'estados-de-una-cotizacion',
        guard: { [RESOURCES.QUOTE]: [READ] },
        updatedAt: LAST_CONTENT_PASS,
      },
      {
        slug: 'enviar-una-cotizacion',
        guard: { [RESOURCES.QUOTE]: [UPDATE] },
        updatedAt: LAST_CONTENT_PASS,
      },
      {
        slug: 'pipeline-de-cotizaciones',
        guard: { [RESOURCES.PIPELINE]: [READ] },
        updatedAt: LAST_CONTENT_PASS,
      },
      {
        slug: 'cancelar-reabrir-archivar-cotizacion',
        guard: { [RESOURCES.QUOTE]: [UPDATE] },
        updatedAt: LAST_CONTENT_PASS,
      },
    ],
  },
  {
    slug: 'eventos',
    icon: CalendarDays,
    articles: [
      {
        slug: 'como-se-crea-un-evento',
        guard: { [RESOURCES.EVENT]: [READ] },
        updatedAt: LAST_CONTENT_PASS,
      },
      {
        slug: 'estados-de-un-evento',
        guard: { [RESOURCES.EVENT]: [READ] },
        updatedAt: LAST_CONTENT_PASS,
      },
      {
        slug: 'ficha-del-evento',
        guard: { [RESOURCES.EVENT]: [READ] },
        updatedAt: LAST_CONTENT_PASS,
      },
      {
        slug: 'completar-opciones-pendientes',
        guard: { [RESOURCES.EVENT]: [MANAGE_SELECTIONS] },
        updatedAt: LAST_CONTENT_PASS,
      },
      {
        slug: 'asignar-personal-a-un-evento',
        guard: { [RESOURCES.EVENT]: [UPDATE] },
        updatedAt: LAST_CONTENT_PASS,
      },
      {
        slug: 'registrar-pagos-de-un-evento',
        guard: { [RESOURCES.PAYMENT]: [READ] },
        updatedAt: LAST_CONTENT_PASS,
      },
    ],
  },
  {
    slug: 'calendario',
    icon: Calendar,
    articles: [
      {
        slug: 'ver-eventos-en-el-calendario',
        guard: { [RESOURCES.EVENT]: [READ] },
        updatedAt: LAST_CONTENT_PASS,
      },
    ],
  },
  {
    slug: 'catalogo',
    icon: Package,
    articles: [
      {
        slug: 'crear-estacion-y-precios',
        guard: { [RESOURCES.PRODUCT]: [CREATE] },
        updatedAt: LAST_CONTENT_PASS,
      },
      {
        slug: 'armar-servicios-y-opciones',
        guard: { [RESOURCES.PRODUCT]: [CREATE] },
        updatedAt: LAST_CONTENT_PASS,
      },
    ],
  },
  {
    slug: 'tipos-de-evento',
    icon: CalendarCog,
    articles: [
      {
        slug: 'crear-tipo-de-evento-y-color',
        guard: { [RESOURCES.EVENT_TYPE]: [CREATE] },
        updatedAt: LAST_CONTENT_PASS,
      },
    ],
  },
  {
    slug: 'clientes',
    icon: Users,
    articles: [
      {
        slug: 'cargar-un-cliente',
        guard: { [RESOURCES.CLIENT]: [CREATE] },
        updatedAt: LAST_CONTENT_PASS,
      },
      {
        slug: 'historial-y-estado-del-cliente',
        guard: { [RESOURCES.CLIENT]: [READ] },
        updatedAt: LAST_CONTENT_PASS,
      },
    ],
  },
  {
    slug: 'personal',
    icon: ChefHat,
    articles: [
      {
        slug: 'alta-y-asignacion-de-personal',
        guard: { [RESOURCES.STAFF]: [CREATE] },
        updatedAt: LAST_CONTENT_PASS,
      },
    ],
  },
  {
    slug: 'configuracion',
    icon: Settings,
    articles: [
      { slug: 'perfil-contrasena-y-sesiones', updatedAt: LAST_CONTENT_PASS },
      {
        slug: 'impuestos-y-valores-por-defecto',
        guard: { [RESOURCES.TAX_RATES]: [VIEW] },
        updatedAt: LAST_CONTENT_PASS,
      },
      {
        slug: 'plantilla-del-pdf-de-cotizacion',
        guard: { [RESOURCES.QUOTE_PDF_TEMPLATE]: [VIEW] },
        updatedAt: LAST_CONTENT_PASS,
      },
    ],
  },
  {
    // Device/browser mechanics, not a business resource — no guard, useful to any logged-in role.
    slug: 'instalacion',
    icon: Smartphone,
    articles: [
      { slug: 'instalar-en-ios', updatedAt: LAST_CONTENT_PASS },
      { slug: 'instalar-en-android', updatedAt: LAST_CONTENT_PASS },
    ],
  },
];

export function findArticleCategory(articleSlug: string): HelpCategoryEntry | undefined {
  return HELP_CATEGORIES.find((category) =>
    category.articles.some((article) => article.slug === articleSlug),
  );
}

export function findArticle(articleSlug: string): HelpArticleEntry | undefined {
  return findArticleCategory(articleSlug)?.articles.find((article) => article.slug === articleSlug);
}
