'use client';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import type { UpdateOptionInput } from '@repo/schemas';
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
    <Modal open={open} onCancel={onClose} footer={null} title={t(option ? 'option.edit.title' : 'option.create.title')}>
      {open && (
        <OptionForm
          key={option?.id ?? 'create'}
          initialValues={option ? { name: option.name } : undefined}
          onSubmit={onSubmit}
          isPending={isPending}
        />
      )}
    </Modal>
  );
}
