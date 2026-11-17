'use client';
import { useEffect, useRef, useState } from 'react';
import { Form } from 'antd';
import { EditorContent, useEditor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { lengthStatus } from '@/lib/format/markdown';
import { docToMarkdown, markdownToDoc, richTextExtensions } from './richText';
import { RichTextToolbar } from './RichTextToolbar';

export interface RichTextEditorProps {
  /** Markdown. */
  value?: string;
  onChange?: (value: string) => void;
  maxLength: number;
  placeholder?: string;
  'aria-label'?: string;
  id?: string;
  /** `compact` for a few lines, `tall` for long-form text. */
  size?: 'compact' | 'tall';
}

const CONTENT_HEIGHT = {
  compact: 'min-h-20 max-h-48',
  tall: 'min-h-48 max-h-[60vh]',
};

export function RichTextEditorField({
  value = '',
  onChange,
  maxLength,
  placeholder,
  'aria-label': ariaLabel,
  id,
  size = 'compact',
}: RichTextEditorProps) {
  const { t } = useTranslation('common');
  const { status } = Form.Item.useStatus();
  const [initialContent] = useState(() => markdownToDoc(value));
  // Last Markdown sent up: a `value` equal to it is our own echo, not an external reset.
  const emitted = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: richTextExtensions,
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        role: 'textbox',
        'aria-multiline': 'true',
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
        class: `${CONTENT_HEIGHT[size]} overflow-y-auto px-3 py-2 text-sm outline-none wrap-break-word [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-line [&_blockquote]:border-l-4 [&_blockquote]:pl-3 [&_a]:text-blue [&_a]:underline [&_p]:my-1`,
      },
    },
    onUpdate: ({ editor: current }) => {
      const next = current.isEmpty ? '' : docToMarkdown(current.getJSON());
      emitted.current = next;
      onChangeRef.current?.(next);
    },
  });

  useEffect(() => {
    if (!editor || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(markdownToDoc(value), { emitUpdate: false });
  }, [editor, value]);

  const { count, over } = lengthStatus(value, maxLength);
  const border =
    status === 'error' || over ? 'border-error' : 'border-line focus-within:border-primary';

  return (
    <div className="flex flex-col gap-1">
      <div className={`bg-surface overflow-hidden rounded-lg border transition-colors ${border}`}>
        {editor && <RichTextToolbar editor={editor} />}
        <div className="relative">
          {!value && placeholder && (
            <span className="text-muted pointer-events-none absolute top-3 left-3 text-sm">
              {placeholder}
            </span>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>
      <span aria-live="polite" className={`self-end text-xs ${over ? 'text-error' : 'text-muted'}`}>
        {t('richText.counter', { count, max: maxLength })}
      </span>
    </div>
  );
}
