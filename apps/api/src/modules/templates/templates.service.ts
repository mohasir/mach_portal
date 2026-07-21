import { TEMPLATE_TYPES, type QuotePdfTemplateContent } from '@repo/schemas';
import { TemplatesRepository } from './templates.repository';
import { quotePdfTemplateResource } from './templates.resource';

export class TemplatesService {
  constructor(private repo: TemplatesRepository) {}

  async getQuotePdf() {
    const row = await this.repo.findByType(TEMPLATE_TYPES.QUOTE_PDF);
    return quotePdfTemplateResource(row);
  }

  async updateQuotePdf(content: QuotePdfTemplateContent) {
    const row = await this.repo.upsertByType(TEMPLATE_TYPES.QUOTE_PDF, content);
    return quotePdfTemplateResource(row);
  }
}
