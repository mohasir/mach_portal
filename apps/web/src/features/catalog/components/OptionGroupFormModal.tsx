'use client';
import { useEffect } from 'react';
import { Button, Form } from 'antd';
import { useTranslation } from 'react-i18next';
import type { UpdateOptionGroupInput } from '@repo/schemas';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { useOptionGroupMutations } from '../hooks/useOptionGroupMutations';
import { OptionGroupForm } from './OptionGroupForm';
import type { OptionGroup } from '../types';

interface OptionGroupFormModalProps {
  productId: string;
  group: OptionGroup | null;
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
  const { createOptionGroup, updateOptionGroup, isPending } = useOptionGroupMutations();
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

  return (
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
  );
}
