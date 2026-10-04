// ILIKE pattern that matches `text` anywhere, with `%`, `_` and `\` taken literally instead of as
// wildcards (Postgres' default LIKE escape character is `\`).
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}
