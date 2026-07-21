import { z } from 'zod';
import { optionalText } from './fields';

export const TEMPLATE_TYPES = {
  QUOTE_PDF: 'quote_pdf',
} as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[keyof typeof TEMPLATE_TYPES];

export const serviceInfoSchema = z.object({
  label: z.string().min(1).max(100),
  duration: z.string().min(1).max(200),
});
export type ServiceInfo = z.infer<typeof serviceInfoSchema>;

export const quotePdfTemplateContentSchema = z.object({
  termsAndConditions: z.array(z.string().min(1).max(300)).max(20).default([]),
  validityNote: optionalText(300),
  dietaryNote: optionalText(300),
  services: z.array(serviceInfoSchema).max(20).default([]),
});
export type QuotePdfTemplateContent = z.infer<typeof quotePdfTemplateContentSchema>;

export const updateQuotePdfTemplateSchema = z.object({
  content: quotePdfTemplateContentSchema,
});
export type UpdateQuotePdfTemplateInput = z.infer<typeof updateQuotePdfTemplateSchema>;
