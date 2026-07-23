'use client';
import { Button, Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth/client';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { RoleTag } from '@/components/shared/RoleTag';
import { useUpdateProfile } from '../hooks/useUpdateProfile';
import { SettingsCard } from './SettingsCard';

interface ProfileFormValues {
  name: string;
}

export function ProfileInfoCard() {
  const { t } = useTranslation('settings');
  const { data } = useSession();
  const user = data?.user as
    | { name: string; email: string; image?: string | null; role?: string | null; updatedAt?: Date }
    | undefined;
  const [form] = Form.useForm<ProfileFormValues>();
  const { updateProfile, isPending } = useUpdateProfile();

  const initialValues: ProfileFormValues = { name: user?.name ?? '' };
  const unchanged = useIsFormUnchanged(form, user ? initialValues : undefined);

  const onFinish = (values: ProfileFormValues) => {
    void updateProfile(values.name);
  };

  return (
    <SettingsCard title={t('profile.title')}>
      <div className="mb-6">
        <AvatarUser
          name={user?.name ?? ''}
          email={user?.email}
          size={64}
          extra={<RoleTag role={user?.role} className="mt-1" />}
        />
      </div>

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
    </SettingsCard>
  );
}
