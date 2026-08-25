'use client';
import { useEffect } from 'react';
import { Button, Form } from 'antd';
import { useTranslation } from 'react-i18next';
import type { UpdateOptionInput } from '@repo/schemas';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { useOptionMutations } from '../hooks/useOptionMutations';
import { OptionForm } from './OptionForm';
import type { Option } from '../types';

interface OptionFormModalProps {
  optionGroupId: string;
  option: Option | null;
  open: boolean;
  onClose: () => void;
}

export function OptionFormModal({ optionGroupId, option, open, onClose }: OptionFormModalProps) {
  const { t } = useTranslation('catalog');
  const { createOption, updateOption, isPending } = useOptionMutations();
  const [form] = Form.useForm<UpdateOptionInput>();

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, option, form]);

  const onSubmit = async (values: UpdateOptionInput) => {
    try {
      if (option) await updateOption(option.id, values);
      else await createOption({ ...values, optionGroupId });
      onClose();
    } catch {
      // error notificado por useApiError
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t(option ? 'option.edit.title' : 'option.create.title')}
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
          <OptionForm
            key={option?.id ?? 'create'}
            form={form}
            initialValues={
              option
                ? { name: option.name, description: option.description ?? undefined }
                : undefined
            }
            onSubmit={onSubmit}
          />
        </div>
      )}
    </BottomSheet>
  );
}
