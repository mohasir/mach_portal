'use client';
import { Button, Empty, Form, Input, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import type { AssignStaffInput } from '@repo/schemas';
import { useStaffAvailability } from '@/features/staff';
import { useAssignStaff } from '@/features/events';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { blurActiveElementOnTouch } from '@/lib/utils/dom';

interface AssignStaffModalProps {
  eventId: string | null;
  eventDate: string | null;
  open: boolean;
  onClose: () => void;
}

type FormValues = Omit<AssignStaffInput, 'eventId'>;

export function AssignStaffModal({ eventId, eventDate, open, onClose }: AssignStaffModalProps) {
  const { t } = useTranslation('events');
  const [form] = Form.useForm<FormValues>();
  const { data: available, isLoading } = useStaffAvailability(
    open ? (eventDate ?? undefined) : undefined,
  );
  const { assignStaff, isPending } = useAssignStaff();

  const onSubmit = async (values: FormValues) => {
    if (!eventId) return;
    try {
      await assignStaff({ eventId, ...values });
      form.resetFields();
      onClose();
    } catch {
      // error notificado por useApiError
    }
  };

  const onCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <WrapperModal open={open} onCancel={onCancel} title={t('assignStaff.title')} destroyOnHidden>
      {!isLoading && !available?.length ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('assignStaff.empty')} />
      ) : (
        <Form form={form} layout="vertical" onFinish={onSubmit} requiredMark={false}>
          <Form.Item
            name="staffId"
            label={<FieldLabel title={t('assignStaff.staffLabel')} required />}
            rules={[{ required: true }]}
          >
            <Select
              showSearch={{ optionFilterProp: 'label' }}
              loading={isLoading}
              placeholder={t('assignStaff.staffPlaceholder')}
              options={available?.map((member) => ({ value: member.id, label: member.name }))}
              onSelect={blurActiveElementOnTouch}
            />
          </Form.Item>

          <Form.Item
            name="role"
            label={<FieldLabel title={t('assignStaff.roleLabel')} />}
            rules={[{ max: 100 }]}
          >
            <Input placeholder={t('assignStaff.rolePlaceholder')} />
          </Form.Item>

          <Form.Item className="mb-0">
            <Button type="primary" htmlType="submit" loading={isPending} block>
              {t('assignStaff.submit')}
            </Button>
          </Form.Item>
        </Form>
      )}
    </WrapperModal>
  );
}
