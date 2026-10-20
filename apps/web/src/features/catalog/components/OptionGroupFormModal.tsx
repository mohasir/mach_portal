'use client';
import { useEffect } from 'react';
import { Button, Form } from 'antd';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { UpdateOptionGroupInput } from '@repo/schemas';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { useActionConfirm } from '@/components/shared/ConfirmDialogs';
import { useCan } from '@/lib/auth/useCan';
import { useOptionGroupMutations } from '../hooks/useOptionGroupMutations';
import { OptionGroupForm } from './OptionGroupForm';
import type { CatalogOptionGroup } from '../types';

interface OptionGroupFormModalProps {
  productId: string;
  group: CatalogOptionGroup | null;
  open: boolean;
  onClose: () => void;
}

export function OptionGroupFormModal({
  productId,
  group,
  open,
  onClose,
}: OptionGroupFormModalProps) {
  const { t } = useTranslation('catalog');
  const { createOptionGroup, updateOptionGroup, deleteOptionGroup, isDeleting, isPending } =
    useOptionGroupMutations();
  const can = useCan();
  const [confirm, confirmContextHolder] = useActionConfirm();
  const canDelete =
    !!group && !group.isUsed && can({ [RESOURCES.PRODUCT_OPTION]: [ACTIONS.DELETE] });
  const [form] = Form.useForm<UpdateOptionGroupInput>();

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, group, form]);

  const onSubmit = async (values: UpdateOptionGroupInput) => {
    try {
      if (group) await updateOptionGroup(group.id, values);
      else await createOptionGroup({ ...values, productId });
      onClose();
    } catch {
      // error notificado por useApiError
    }
  };

  const onDelete = () =>
    group &&
    confirm({
      title: t('optionGroup.deleteConfirm.title'),
      content: t('optionGroup.deleteConfirm.content'),
      danger: true,
      onOk: async () => {
        await deleteOptionGroup(group.id);
        onClose();
      },
    });

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={t(group ? 'optionGroup.edit.title' : 'optionGroup.create.title')}
        footerClassName="shadow-[0_-4px_8px_-2px_rgba(0,0,0,0.08)]"
        footer={
          <div className="py-2 pt-4">
            <Button type="primary" block loading={isPending} onClick={() => form.submit()}>
              {t('form.save')}
            </Button>
            {canDelete && (
              <Button
                danger
                block
                className="mt-2"
                icon={<Trash2 size={16} />}
                loading={isDeleting}
                onClick={onDelete}
              >
                {t('actions.deletePermanently')}
              </Button>
            )}
          </div>
        }
      >
        {open && (
          <div className="p-4">
            <OptionGroupForm
              key={group?.id ?? 'create'}
              form={form}
              initialValues={
                group
                  ? {
                      label: group.label,
                      selectionType: group.selectionType,
                      maxSelect: group.maxSelect ?? undefined,
                    }
                  : undefined
              }
              onSubmit={onSubmit}
            />
          </div>
        )}
      </BottomSheet>
      {confirmContextHolder}
    </>
  );
}
