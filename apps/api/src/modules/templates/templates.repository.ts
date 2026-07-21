import { and, eq } from 'drizzle-orm';
import type { TemplateType } from '@repo/schemas';
import type { Database } from '../../db';
import { templates } from '../../db/schema';
import { publicTemplateColumns, type PublicTemplate } from './templates.resource';

const DEFAULT_LOCALE = 'es';

export class TemplatesRepository {
  constructor(private db: Database) {}

  findByType(type: TemplateType, locale = DEFAULT_LOCALE) {
    return this.db
      .select(publicTemplateColumns)
      .from(templates)
      .where(and(eq(templates.type, type), eq(templates.locale, locale)))
      .limit(1)
      .then((r) => r[0] as PublicTemplate | undefined);
  }

  upsertByType(type: TemplateType, content: unknown, locale = DEFAULT_LOCALE) {
    return this.db
      .insert(templates)
      .values({ type, locale, content })
      .onConflictDoUpdate({
        target: [templates.type, templates.locale],
        set: { content, updatedAt: new Date() },
      })
      .returning(publicTemplateColumns)
      .then((r) => r[0]! as PublicTemplate);
  }
}
