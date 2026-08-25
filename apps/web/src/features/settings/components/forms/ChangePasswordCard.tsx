'use client';
import { Button, Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { useChangePassword } from '../../hooks/useChangePassword';
import { WrapperCard } from '@/components/shared/WrapperCard';

interface ChangePasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function ChangePasswordCard() {
  const { t } = useTranslation('settings');
  const [form] = Form.useForm<ChangePasswordFormValues>();
  const { changePassword, isPending } = useChangePassword();

  const onFinish = async (values: ChangePasswordFormValues) => {
    await changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
    form.resetFields();
  };

  return (
    <WrapperCard title={t('profile.changePassword.title')}>
      <Form layout="vertical" form={form} onFinish={onFinish} requiredMark={false}>
        <Form.Item
          name="currentPassword"
          label={<FieldLabel title={t('profile.changePassword.current')} required />}
          rules={[{ required: true, message: t('profile.changePassword.currentRequired') }]}
        >
          <Input.Password />
        </Form.Item>

        <Form.Item
          name="newPassword"
          label={<FieldLabel title={t('profile.changePassword.new')} required />}
          rules={[
            { required: true, message: t('profile.changePassword.newRequired') },
            { min: 8, message: t('profile.changePassword.newRequired') },
          ]}
        >
          <Input.Password />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label={<FieldLabel title={t('profile.changePassword.confirm')} required />}
          dependencies={['newPassword']}
          rules={[
            { required: true, message: t('profile.changePassword.confirmRequired') },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                return Promise.reject(new Error(t('profile.changePassword.mismatch')));
              },
            }),
          ]}
        >
          <Input.Password />
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={isPending}>
          {t('save')}
        </Button>
      </Form>
    </WrapperCard>
  );
}
