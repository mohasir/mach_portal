'use client';
import { App } from 'antd';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { useConfirmModal, type ConfirmOptions } from './ConfirmModal';
import { useDeleteConfirm } from './DeleteConfirmModal';

/** Action confirm: `modal.confirm` on desktop; on mobile, `danger` options route
 * to the delete-styled dialog (`useDeleteConfirm`) and the rest to the generic
 * one (`useConfirmModal`) — same split `DataTableRowActions` uses internally,
 * extracted for callers outside it. */
export function useActionConfirm() {
  const { modal } = App.useApp();
  const isDesktop = useIsDesktop();
  const [confirmMobile, confirmContextHolder] = useConfirmModal();
  const [confirmDelete, deleteContextHolder] = useDeleteConfirm();

  const confirm = (options: ConfirmOptions) => {
    if (!isDesktop) return options.danger ? confirmDelete(options) : confirmMobile(options);
    modal.confirm({
      title: options.title,
      content: options.content,
      okText: options.okText,
      cancelText: options.cancelText,
      okButtonProps: options.danger ? { danger: true } : undefined,
      onOk: options.onOk,
    });
  };

  return [
    confirm,
    <>
      {confirmContextHolder}
      {deleteContextHolder}
    </>,
  ] as const;
}
