'use client';
import { useState, type ReactNode } from 'react';
import { Button, Modal, Typography } from 'antd';
import type { IconType } from 'react-icons';
import {
  TbAlertTriangleFilled,
  TbHelpSquareRoundedFilled,
  TbInfoSquareRoundedFilled,
} from 'react-icons/tb';
import { useTranslation } from 'react-i18next';

export type ConfirmModalType = 'info' | 'help' | 'warning';

const TYPE_STYLES: Record<
  ConfirmModalType,
  { icon: IconType; bg: string; bgStrong: string; text: string }
> = {
  info: {
    icon: TbInfoSquareRoundedFilled,
    bg: 'bg-blue-500/10',
    bgStrong: 'bg-blue-500/20',
    text: 'text-blue-500',
  },
  help: {
    icon: TbHelpSquareRoundedFilled,
    bg: 'bg-primary/10',
    bgStrong: 'bg-primary/20',
    text: 'text-primary',
  },
  warning: {
    icon: TbAlertTriangleFilled,
    bg: 'bg-amber-500/10',
    bgStrong: 'bg-amber-500/20',
    text: 'text-amber-500',
  },
};

export interface ConfirmOptions {
  title: ReactNode;
  content?: ReactNode;
  okText?: string;
  cancelText?: string;
  type?: ConfirmModalType;
  danger?: boolean;
  onOk: () => void;
}

interface ConfirmModalProps {
  open: boolean;
  title?: ReactNode;
  content?: ReactNode;
  okText?: string;
  cancelText?: string;
  type?: ConfirmModalType;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  content,
  okText,
  cancelText,
  type = 'help',
  danger,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t: tc } = useTranslation('common');
  const { icon: Icon, bg, bgStrong, text } = TYPE_STYLES[type];

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      centered
      width={{ xs: '90%', md: 340 }}
      classNames={{ container: 'rounded-3xl!' }}
    >
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <div className={`flex size-16 items-center justify-center rounded-full ${bg}`}>
          <div className={`flex size-11 items-center justify-center rounded-full ${bgStrong}`}>
            <Icon size={28} className={text} />
          </div>
        </div>
        <Typography.Title level={4} className="font-heading font-bold text-brown m-0!">
          {title}
        </Typography.Title>
        {content && (
          <Typography.Text type="secondary" className="text-base">
            {content}
          </Typography.Text>
        )}
        <div className="mt-3 flex w-full gap-3">
          <Button className="min-w-0 flex-1 whitespace-normal" onClick={onCancel}>
            {cancelText ?? tc('cancel')}
          </Button>
          <Button
            danger={danger}
            type="primary"
            className="min-w-0 flex-1 whitespace-normal"
            onClick={onConfirm}
          >
            {okText ?? tc('confirmAction')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface DialogState {
  open: boolean;
  title?: ReactNode;
  content?: ReactNode;
  okText?: string;
  cancelText?: string;
  type?: ConfirmModalType;
  danger?: boolean;
  onOk?: () => void;
}

/** Mobile-only replacement for a plain `modal.confirm({ ... })` (non-delete confirmations). */
export function useConfirmModal() {
  const [state, setState] = useState<DialogState>({ open: false });

  const confirm = (options: ConfirmOptions) => setState({ ...options, open: true });
  const close = () => setState((s) => ({ ...s, open: false }));

  const contextHolder = (
    <ConfirmModal
      open={state.open}
      title={state.title}
      content={state.content}
      okText={state.okText}
      cancelText={state.cancelText}
      type={state.type}
      danger={state.danger}
      onConfirm={() => {
        state.onOk?.();
        close();
      }}
      onCancel={close}
    />
  );

  return [confirm, contextHolder] as const;
}
