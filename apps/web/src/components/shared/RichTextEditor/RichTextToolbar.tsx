'use client';
import { useState, type ReactNode } from 'react';
import { Button, Input, Popover, Typography, type ButtonProps } from 'antd';
import { useEditorState, type Editor } from '@tiptap/react';
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  TextQuote,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { normalizeLinkInput } from './richText';

// Extra props are spread so Popover can attach its trigger handlers to the button.
function ToolbarButton({
  label,
  active,
  icon,
  ...rest
}: ButtonProps & { label: string; active: boolean; icon: ReactNode }) {
  return (
    <Button
      {...rest}
      type="text"
      icon={icon}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={active ? 'bg-mist text-navy' : 'text-muted'}
    />
  );
}

function LinkButton({ editor, active }: { editor: Editor; active: boolean }) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState('');
  const [invalid, setInvalid] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setHref((editor.getAttributes('link').href as string | undefined) ?? '');
      setInvalid(false);
    }
    setOpen(next);
  };

  const apply = () => {
    const normalized = normalizeLinkInput(href);
    if (!normalized) {
      setInvalid(true);
      return;
    }
    const chain = editor.chain().focus().extendMarkRange('link');
    if (editor.state.selection.empty && !active) {
      chain
        .insertContent({
          type: 'text',
          text: normalized,
          marks: [{ type: 'link', attrs: { href: normalized } }],
        })
        .run();
    } else {
      chain.setLink({ href: normalized }).run();
    }
    setOpen(false);
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      trigger="click"
      placement="bottom"
      content={
        <div className="flex w-64 max-w-full flex-col gap-2">
          <Input
            autoFocus
            value={href}
            inputMode="url"
            aria-label={t('richText.link')}
            placeholder={t('richText.linkPlaceholder')}
            status={invalid ? 'error' : undefined}
            onChange={(event) => {
              setHref(event.target.value);
              setInvalid(false);
            }}
            onPressEnter={(event) => {
              event.preventDefault();
              apply();
            }}
          />
          {invalid && (
            <Typography.Text type="danger" className="text-xs">
              {t('richText.linkInvalid')}
            </Typography.Text>
          )}
          <div className="flex justify-end gap-2">
            {active && (
              <Button size="small" onClick={remove}>
                {t('richText.linkRemove')}
              </Button>
            )}
            <Button size="small" type="primary" onClick={apply}>
              {t('richText.linkApply')}
            </Button>
          </div>
        </div>
      }
    >
      <ToolbarButton label={t('richText.link')} active={active} icon={<Link2 size={16} />} />
    </Popover>
  );
}

export function RichTextToolbar({ editor }: { editor: Editor }) {
  const { t } = useTranslation('common');
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      heading2: e.isActive('heading', { level: 2 }),
      heading3: e.isActive('heading', { level: 3 }),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      blockquote: e.isActive('blockquote'),
      link: e.isActive('link'),
    }),
  });

  const run = (command: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) =>
    command(editor.chain().focus()).run();

  return (
    <div
      role="toolbar"
      aria-label={t('richText.toolbar')}
      className="border-line flex flex-wrap items-center gap-0.5 border-b p-1"
    >
      <ToolbarButton
        label={t('richText.bold')}
        active={state.bold}
        icon={<Bold size={16} />}
        onClick={() => run((c) => c.toggleBold())}
      />
      <ToolbarButton
        label={t('richText.italic')}
        active={state.italic}
        icon={<Italic size={16} />}
        onClick={() => run((c) => c.toggleItalic())}
      />
      <ToolbarButton
        label={t('richText.heading2')}
        active={state.heading2}
        icon={<Heading2 size={16} />}
        onClick={() => run((c) => c.toggleHeading({ level: 2 }))}
      />
      <ToolbarButton
        label={t('richText.heading3')}
        active={state.heading3}
        icon={<Heading3 size={16} />}
        onClick={() => run((c) => c.toggleHeading({ level: 3 }))}
      />
      <ToolbarButton
        label={t('richText.bulletList')}
        active={state.bulletList}
        icon={<List size={16} />}
        onClick={() => run((c) => c.toggleBulletList())}
      />
      <ToolbarButton
        label={t('richText.orderedList')}
        active={state.orderedList}
        icon={<ListOrdered size={16} />}
        onClick={() => run((c) => c.toggleOrderedList())}
      />
      <ToolbarButton
        label={t('richText.blockquote')}
        active={state.blockquote}
        icon={<TextQuote size={16} />}
        onClick={() => run((c) => c.toggleBlockquote())}
      />
      <LinkButton editor={editor} active={state.link} />
    </div>
  );
}
