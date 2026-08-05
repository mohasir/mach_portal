'use client';
import { Button, Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth/client';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { useUpdateProfile } from '../../hooks/useUpdateProfile';

interface ProfileFormValues {
  name: string;
}

export function ProfileNameForm() {
  const { t } = useTranslation('settings');
  const { data } = useSession();
  const user = data?.user as { name: string; updatedAt?: Date } | undefined;
  const [form] = Form.useForm<ProfileFormValues>();
  const { updateProfile, isPending } = useUpdateProfile();

  const initialValues: ProfileFormValues = { name: user?.name ?? '' };
  const unchanged = useIsFormUnchanged(form, user ? initialValues : undefined);

  const onFinish = (values: ProfileFormValues) => {
    void updateProfile(values.name);
  };

  return (
    <Form
      key={String(user?.updatedAt ?? '')}
      layout="vertical"
      form={form}
      initialValues={initialValues}
      onFinish={onFinish}
      requiredMark={false}
    >
      <Form.Item
        name="name"
        label={<FieldLabel title={t('profile.name')} required />}
        rules={[{ required: true, message: t('profile.nameRequired') }, { max: 120 }]}
      >
        <Input />
      </Form.Item>

      <Button type="primary" htmlType="submit" loading={isPending} disabled={unchanged}>
        {t('save')}
      </Button>
    </Form>
  );
}
