'use client';
import { useEffect } from 'react';
import { Button, Form } from 'antd';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { UpdateOptionInput } from '@repo/schemas';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { useActionConfirm } from '@/components/shared/ConfirmDialogs';
import { useCan } from '@/lib/auth/useCan';
import { useOptionMutations } from '../hooks/useOptionMutations';
import { OptionForm } from './OptionForm';
import type { CatalogOption } from '../types';

interface OptionFormModalProps {
  optionGroupId: string;
  option: CatalogOption | null;
  open: boolean;
  onClose: () => void;
}

export function OptionFormModal({ optionGroupId, option, open, onClose }: OptionFormModalProps) {
  const { t } = useTranslation('catalog');
  const { createOption, updateOption, deleteOption, isDeleting, isPending } = useOptionMutations();
  const can = useCan();
  const [confirm, confirmContextHolder] = useActionConfirm();
  const canDelete =
    !!option && !option.isUsed && can({ [RESOURCES.PRODUCT_OPTION]: [ACTIONS.DELETE] });
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

  const onDelete = () =>
    option &&
    confirm({
      title: t('option.deleteConfirm.title'),
      content: t('option.deleteConfirm.content'),
      danger: true,
      onOk: async () => {
        await deleteOption(option.id);
        onClose();
      },
    });

  return (
    <>
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
      {confirmContextHolder}
    </>
  );
}
