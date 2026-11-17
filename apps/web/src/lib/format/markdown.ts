const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Whether a link from user-authored Markdown may be rendered as a link. Parsing with `URL`
 * normalizes casing and the whitespace browsers ignore, so `java\nscript:` is caught too.
 */
export function isSafeLinkHref(href: string | null | undefined): boolean {
  if (!href) return false;
  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(href.trim()).protocol);
  } catch {
    return false;
  }
}

const HTML_ENTITIES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&amp;': '&',
};

/** Markdown reduced to one line of plain text, for previews where formatting does not fit. */
export function markdownToPlainText(markdown: string, maxLength?: number): string {
  const text = markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*(?:>[ \t]?)+/gm, '')
    .replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(?<![\\\w])([*_])(?!\s)(.+?)(?<![\s\\])\1(?!\w)/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\\([\\`*_{}[\]()#+\-.!>~|<])/g, '$1')
    .replace(/&(?:lt|gt|quot|#39|nbsp|amp);/g, (entity) => HTML_ENTITIES[entity] ?? entity)
    .replace(/\s+/g, ' ')
    .trim();

  if (maxLength === undefined) return text;
  const chars = Array.from(text);
  if (chars.length <= maxLength) return text;
  return `${chars
    .slice(0, Math.max(0, maxLength - 1))
    .join('')
    .trimEnd()}…`;
}

/** Length as the API measures it: the stored Markdown, in UTF-16 units. */
export function lengthStatus(value: string | undefined, max: number) {
  const count = value?.length ?? 0;
  return { count, over: count > max };
}

/**
 * Form validator matching `lengthStatus`. AntD's built-in `max` counts code points, so emoji text
 * could pass the form and still be rejected by the API.
 */
export const maxLengthValidator =
  (max: number, message: string) => (_rule: unknown, value: string | undefined) =>
    lengthStatus(value, max).over ? Promise.reject(new Error(message)) : Promise.resolve();
