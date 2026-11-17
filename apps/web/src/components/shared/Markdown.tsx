'use client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { isSafeLinkHref } from '@/lib/format/markdown';

// Mirrors the formats RichTextEditor can produce; anything else stored through the API is
// unwrapped to its text so it cannot embed images, tables or other markup.
const ALLOWED_ELEMENTS = [
  'p',
  'br',
  'strong',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'a',
  'blockquote',
];

interface MarkdownProps {
  children: string;
  className?: string;
}

/** Read-only view of user-authored Markdown. Raw HTML is never rendered as markup. */
export function Markdown({ children, className = '' }: MarkdownProps) {
  return (
    <div
      className={`flex flex-col gap-2 wrap-break-word [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_h4]:text-sm [&_h4]:font-semibold [&_h5]:text-sm [&_h5]:font-semibold [&_h6]:text-sm [&_h6]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:m-0 ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        urlTransform={(url) => (isSafeLinkHref(url) ? url : undefined)}
        components={{
          a: ({ href, children: text }) =>
            href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue underline"
              >
                {text}
              </a>
            ) : (
              <span>{text}</span>
            ),
          blockquote: ({ children: quote }) => (
            <blockquote className="border-line m-0 border-l-4 pl-3">{quote}</blockquote>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
