import { Extension, getSchema, type JSONContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { MarkdownManager } from '@tiptap/markdown';
import { isSafeLinkHref } from '@/lib/format/markdown';

// Code is not an offered format, but stored text may contain it (legacy plain text indented by
// four spaces parses as a code block). Without a handler the parser drops that text silently.
const CodeSpanAsText = Extension.create({
  name: 'codeSpanAsText',
  markdownTokenName: 'codespan',
  parseMarkdown: (token, helpers) => helpers.createTextNode(token.text ?? ''),
});

const CodeBlockAsParagraph = Extension.create({
  name: 'codeBlockAsParagraph',
  markdownTokenName: 'code',
  parseMarkdown: (token, helpers) =>
    helpers.createNode(
      'paragraph',
      null,
      (token.text ?? '')
        .split('\n')
        .flatMap((line, index) => [
          ...(index > 0 ? [helpers.createNode('hardBreak')] : []),
          ...(line ? [helpers.createTextNode(line)] : []),
        ]),
    ),
});

export const richTextExtensions = [
  StarterKit.configure({
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    underline: false,
    heading: { levels: [2, 3] },
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      isAllowedUri: (url) => isSafeLinkHref(url),
      HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
    },
  }),
  CodeSpanAsText,
  CodeBlockAsParagraph,
];

export const richTextSchema = getSchema(richTextExtensions);

const markdown = new MarkdownManager({ extensions: richTextExtensions });

// Markdown links bypass the link extension's URL check, so unsafe ones are unwrapped here.
function withoutUnsafeLinks(node: JSONContent): JSONContent {
  const marks = node.marks?.filter(
    (mark) => mark.type !== 'link' || isSafeLinkHref(mark.attrs?.href as string | undefined),
  );
  return {
    ...node,
    ...(node.marks ? { marks } : {}),
    ...(node.content ? { content: node.content.map(withoutUnsafeLinks) } : {}),
  };
}

export function markdownToDoc(value: string): JSONContent {
  return withoutUnsafeLinks(markdown.parse(value));
}

export function docToMarkdown(doc: JSONContent): string {
  return markdown.serialize(doc).trim();
}

/** URL typed in the link prompt, completed with https when bare, or null when not allowed. */
export function normalizeLinkInput(input: string): string | null {
  const value = input.trim();
  if (!value || /\s/.test(value)) return null;
  const href = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  if (!isSafeLinkHref(href)) return null;
  if (/^https?:/i.test(href) && !new URL(href).hostname.includes('.')) return null;
  return href;
}
