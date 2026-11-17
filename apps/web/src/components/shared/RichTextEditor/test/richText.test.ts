import type { JSONContent } from '@tiptap/react';
import { describe, expect, it } from 'vitest';
import { docToMarkdown, markdownToDoc, normalizeLinkInput, richTextSchema } from '../richText';

const roundTrip = (markdown: string) => docToMarkdown(markdownToDoc(markdown));

const texts = (node: JSONContent): string => node.text ?? (node.content ?? []).map(texts).join(' ');

const marksOf = (node: JSONContent): NonNullable<JSONContent['marks']> => [
  ...(node.marks ?? []),
  ...(node.content ?? []).flatMap(marksOf),
];

describe('richTextSchema', () => {
  it('only knows the allowed formats', () => {
    expect(Object.keys(richTextSchema.marks).sort()).toEqual(['bold', 'italic', 'link']);
    expect(Object.keys(richTextSchema.nodes).sort()).toEqual([
      'blockquote',
      'bulletList',
      'doc',
      'hardBreak',
      'heading',
      'listItem',
      'orderedList',
      'paragraph',
      'text',
    ]);
  });

  it('has no paste rule that turns images, tables, code, rules or styled spans into content', () => {
    const rules = [
      ...Object.values(richTextSchema.nodes).flatMap((type) => type.spec.parseDOM ?? []),
      ...Object.values(richTextSchema.marks).flatMap((type) => type.spec.parseDOM ?? []),
    ];
    const tags = rules.flatMap((rule) => ('tag' in rule && rule.tag ? [rule.tag] : []));
    for (const forbidden of [
      'img',
      'table',
      'pre',
      'code',
      'hr',
      's',
      'del',
      'u',
      'span',
      'font',
    ]) {
      expect(tags.some((tag) => tag === forbidden || tag.startsWith(`${forbidden}[`))).toBe(false);
    }
    const styles = rules.flatMap((rule) => ('style' in rule && rule.style ? [rule.style] : []));
    expect(styles.some((style) => /color|font-size|background/.test(style))).toBe(false);
  });

  it('does not turn a pasted script link into a link', () => {
    const [rule] = richTextSchema.marks.link!.spec.parseDOM!;
    const anchor = (href: string) => ({ getAttribute: () => href }) as unknown as HTMLElement;
    const getAttrs = (rule as { getAttrs: (dom: HTMLElement) => unknown }).getAttrs;
    expect(getAttrs(anchor('javascript:alert(1)'))).toBe(false);
    expect(getAttrs(anchor('data:text/html,x'))).toBe(false);
    expect(getAttrs(anchor('https://example.com'))).not.toBe(false);
  });

  it('ships no paragraph or heading attributes a paste could fill (alignment, colors)', () => {
    expect(Object.keys(richTextSchema.nodes.paragraph!.spec.attrs ?? {})).toEqual([]);
    expect(Object.keys(richTextSchema.nodes.heading!.spec.attrs ?? {})).toEqual(['level']);
  });
});

describe('markdown round trip', () => {
  it.each([
    ['bold', 'Some **bold** text'],
    ['italic', 'Some *italic* text'],
    ['bullet list', '- one\n- two'],
    ['ordered list', '1. one\n2. two'],
    ['link', 'See [the menu](https://example.com/menu)'],
    ['heading', '## Title\n\nBody'],
    ['quote', '> A quote'],
    [
      'everything together',
      '## Title\n\nSome **bold**, *italic* and [a link](https://example.com).\n\n- one\n- two\n\n1. first\n2. second\n\n> A quote',
    ],
  ])('keeps %s stable', (_, markdown) => {
    expect(roundTrip(markdown)).toBe(markdown);
    expect(roundTrip(roundTrip(markdown))).toBe(markdown);
  });

  it('keeps legacy plain text as is', () => {
    expect(roundTrip('Grilled salmon with seasonal vegetables')).toBe(
      'Grilled salmon with seasonal vegetables',
    );
  });

  it('escapes typed HTML so it is stored as text', () => {
    const markdown = docToMarkdown({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] },
      ],
    });
    expect(markdown).not.toContain('<script>');
    expect(markdown).toContain('&lt;script&gt;');
  });

  it('serializes links with their address and title only, whatever else they carry', () => {
    const markdown = docToMarkdown({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'menu',
              marks: [
                {
                  type: 'link',
                  attrs: { href: 'https://example.com', class: 'x', target: '_self', title: 't' },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(markdown).toBe('[menu](https://example.com "t")');
  });

  it('serializes an empty document as an empty string', () => {
    expect(docToMarkdown(markdownToDoc(''))).toBe('');
    expect(docToMarkdown({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('');
  });
});

describe('markdownToDoc', () => {
  it('reduces formats the editor does not offer to schema-valid content, keeping the text', () => {
    const doc = markdownToDoc(
      '`inline code` ~~struck~~ ![logo](https://example.com/x.png)\n\n---\n\n```\nblock code\nsecond line\n```\n\n    indented code',
    );
    expect(() => richTextSchema.nodeFromJSON(doc)).not.toThrow();
    const text = texts(doc);
    for (const kept of [
      'inline code',
      'struck',
      'logo',
      'block code',
      'second line',
      'indented code',
    ]) {
      expect(text).toContain(kept);
    }
  });

  it('drops links to unsafe addresses but keeps their text', () => {
    const doc = markdownToDoc('[click](javascript:alert(1)) and [ok](https://example.com)');
    expect(texts(doc)).toContain('click');
    const hrefs = marksOf(doc).map((mark) => mark.attrs?.href);
    expect(hrefs).toEqual(['https://example.com']);
    expect(docToMarkdown(doc)).toBe('click and [ok](https://example.com)');
  });
});

describe('normalizeLinkInput', () => {
  it('adds https to a bare domain and keeps full addresses', () => {
    expect(normalizeLinkInput(' example.com/menu ')).toBe('https://example.com/menu');
    expect(normalizeLinkInput('http://example.com')).toBe('http://example.com');
    expect(normalizeLinkInput('mailto:sales@example.com')).toBe('mailto:sales@example.com');
  });

  it('rejects empty and unsafe addresses', () => {
    expect(normalizeLinkInput('')).toBeNull();
    expect(normalizeLinkInput('   ')).toBeNull();
    expect(normalizeLinkInput('javascript:alert(1)')).toBeNull();
    expect(normalizeLinkInput('not a url')).toBeNull();
  });
});
