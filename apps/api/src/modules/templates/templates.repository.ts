import { and, eq } from 'drizzle-orm';
import type { TemplateType } from '@repo/schemas';
import type { Database } from '../../db';
import { templates } from '../../db/schema';
import { tenantEq } from '../../lib/tenancy/tenantEq';
import { publicTemplateColumns, type PublicTemplate } from './templates.resource';

const DEFAULT_LOCALE = 'es';

export class TemplatesRepository {
  constructor(
    private db: Database,
    private tenantId: string,
  ) {}

  findByType(type: TemplateType, locale = DEFAULT_LOCALE) {
    return this.db
      .select(publicTemplateColumns)
      .from(templates)
      .where(
        and(
          eq(templates.type, type),
          eq(templates.locale, locale),
          tenantEq(templates, this.tenantId),
        ),
      )
      .limit(1)
      .then((r) => r[0] as PublicTemplate | undefined);
  }

  upsertByType(type: TemplateType, content: unknown, locale = DEFAULT_LOCALE) {
    return this.db
      .insert(templates)
      .values({ type, locale, content, tenantId: this.tenantId })
      .onConflictDoUpdate({
        target: [templates.tenantId, templates.type, templates.locale],
        set: { content, updatedAt: new Date() },
      })
      .returning(publicTemplateColumns)
      .then((r) => r[0]! as PublicTemplate);
  }
}
