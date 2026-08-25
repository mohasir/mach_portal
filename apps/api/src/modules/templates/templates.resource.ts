import type { QuotePdfTemplateContent, TemplateType } from '@repo/schemas';
import { templates } from '../../db/schema';

export const publicTemplateColumns = {
  id: templates.id,
  type: templates.type,
  locale: templates.locale,
  content: templates.content,
  updatedAt: templates.updatedAt,
} as const;

export type PublicTemplate = Pick<
  typeof templates.$inferSelect,
  keyof typeof publicTemplateColumns
> & {
  type: TemplateType;
};

const DEFAULT_CONTENT: QuotePdfTemplateContent = {
  termsAndConditions: [],
  validityNote: undefined,
  dietaryNote: undefined,
  services: [],
};

export const quotePdfTemplateResource = (row: PublicTemplate | undefined) => ({
  content: {
    ...DEFAULT_CONTENT,
    ...(row?.content as Partial<QuotePdfTemplateContent> | undefined),
  },
  updatedAt: row?.updatedAt ?? null,
});

export type QuotePdfTemplateResource = ReturnType<typeof quotePdfTemplateResource>;
