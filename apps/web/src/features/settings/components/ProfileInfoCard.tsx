'use client';
import { Button, Card, Divider, Form, Input, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { RoleType } from '@repo/guards';
import { useSession } from '@/lib/auth/client';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { ROLE_COLORS } from '@/features/users/helpers';
import { useUpdateProfile } from '../hooks/useUpdateProfile';

interface ProfileFormValues {
  name: string;
}

export function ProfileInfoCard() {
  const { t } = useTranslation('settings');
  const { t: tUsers } = useTranslation('users');
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
    <Card>
      <Typography.Title level={4} className="font-heading text-brown m-0!">
        {t('profile.title')}
      </Typography.Title>
      <Divider className="mt-3 mb-6" />

      <div className="mb-6">
        <AvatarUser
          name={user?.name ?? ''}
          email={user?.email}
          size={64}
          extra={
            user?.role && (
              <Tag color={ROLE_COLORS[user.role as RoleType] ?? 'default'} className="mt-1">
                {tUsers(`roles.${user.role}`, user.role)}
              </Tag>
            )
          }
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
    </Card>
  );
}
