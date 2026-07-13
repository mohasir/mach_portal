'use client';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import type { UpdateOptionGroupInput } from '@repo/schemas';
import { useOptionGroupMutations } from '../hooks/useOptionGroupMutations';
import { OptionGroupForm } from './OptionGroupForm';
import type { OptionGroup } from '../types';

interface OptionGroupFormModalProps {
  productId: string;
  group: OptionGroup | null;
  open: boolean;
  onClose: () => void;
}

export function OptionGroupFormModal({ productId, group, open, onClose }: OptionGroupFormModalProps) {
  const { t } = useTranslation('catalog');
  const { createOptionGroup, updateOptionGroup, isPending } = useOptionGroupMutations();

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
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={t(group ? 'optionGroup.edit.title' : 'optionGroup.create.title')}
    >
      {open && (
        <OptionGroupForm
          key={group?.id ?? 'create'}
          initialValues={group ? { label: group.label, maxSelect: group.maxSelect ?? undefined } : undefined}
          onSubmit={onSubmit}
          isPending={isPending}
        />
      )}
    </Modal>
  );
}
