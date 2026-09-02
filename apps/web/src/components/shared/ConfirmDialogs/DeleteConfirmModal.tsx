'use client';
import { useState, type ReactNode } from 'react';
import { Button, Typography } from 'antd';
import { TbAlertSquareRoundedFilled } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import { WrapperModal } from '@/components/shared/WrapperModal';

interface DeleteConfirmOptions {
  title: ReactNode;
  content?: ReactNode;
  okText?: string;
  cancelText?: string;
  onOk: () => void;
}

interface DeleteConfirmModalProps {
  open: boolean;
  title?: ReactNode;
  content?: ReactNode;
  okText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({
  open,
  title,
  content,
  okText,
  cancelText,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  const { t: tc } = useTranslation('common');

  return (
    <WrapperModal open={open} onCancel={onCancel} width={{ xs: '90%', md: 340 }}>
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <div className="bg-error/10 flex size-16 items-center justify-center rounded-full">
          <div className="bg-error/20 flex size-11 items-center justify-center rounded-full">
            <TbAlertSquareRoundedFilled size={28} className="text-error" />
          </div>
        </div>
        {title && (
          <Typography.Title level={4} className="font-heading font-bold text-brown m-0!">
            {title}
          </Typography.Title>
        )}
        {content && (
          <Typography.Text type="secondary" className="text-base">
            {content}
          </Typography.Text>
        )}
        <div className="mt-3 flex w-full gap-3">
          <Button
            danger
            type="primary"
            className="min-w-0 flex-1 whitespace-normal"
            onClick={onConfirm}
          >
            {okText ?? tc('delete')}
          </Button>
          <Button className="min-w-0 flex-1 whitespace-normal" onClick={onCancel}>
            {cancelText ?? tc('cancel')}
          </Button>
        </div>
      </div>
    </WrapperModal>
  );
}

interface DialogState {
  open: boolean;
  title?: ReactNode;
  content?: ReactNode;
  okText?: string;
  cancelText?: string;
  onOk?: () => void;
}

/** Mobile-only replacement for `modal.confirm({ okButtonProps: { danger: true } })`. */
export function useDeleteConfirm() {
  const [state, setState] = useState<DialogState>({ open: false });

  const confirmDelete = (options: DeleteConfirmOptions) => setState({ ...options, open: true });
  const close = () => setState((s) => ({ ...s, open: false }));

  const contextHolder = (
    <DeleteConfirmModal
      open={state.open}
      title={state.title}
      content={state.content}
      okText={state.okText}
      cancelText={state.cancelText}
      onConfirm={() => {
        state.onOk?.();
        close();
      }}
      onCancel={close}
    />
  );

  return [confirmDelete, contextHolder] as const;
}
