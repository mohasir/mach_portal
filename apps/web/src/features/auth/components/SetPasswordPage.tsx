'use client';
import { useState } from 'react';
import { App, Button, Flex, Form, Input, Result, Typography } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { resetPassword } from '@/lib/auth/client';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';

type SetPasswordInput = { password: string; confirmPassword: string };

export function SetPasswordPage() {
  const { t } = useTranslation('auth');
  const { message } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const reason = searchParams.get('reason') === 'reset' ? 'reset' : 'create';
  const [form] = Form.useForm<SetPasswordInput>();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const onFinish = async ({ password }: SetPasswordInput) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await resetPassword({ newPassword: password, token });
      if (res.error) {
        message.error(res.error.message ?? t('setPassword.errors.invalidToken'));
        return;
      }
      setSuccess(true);
    } catch {
      message.error(t('errors.unexpected'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return <Result status="error" title={t('setPassword.errors.missingToken')} />;
  }

  if (success) {
    return (
      <Flex vertical gap={16}>
        <Result status="success" title={t('setPassword.success')} />
        <Button type="primary" block onClick={() => router.replace('/login')}>
          {t('setPassword.goToLogin')}
        </Button>
      </Flex>
    );
  }

  return (
    <>
      <Typography.Title level={2} className="font-heading text-brown mt-10 mb-2 text-center">
        {t(`setPassword.${reason}.title`)}
      </Typography.Title>
      <Typography.Text type="secondary" className="mb-6 block text-center">
        {t(`setPassword.${reason}.description`)}
      </Typography.Text>

      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item
          name="password"
          label={<FieldLabel title={t('password')} required />}
          rules={[
            { required: true, message: t('validation.required') },
            { min: 8, message: t('validation.passwordMin') },
          ]}
        >
          <Input.Password placeholder={t('passwordPlaceholder')} />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label={<FieldLabel title={t('setPassword.confirmPassword')} required />}
          dependencies={['password']}
          rules={[
            { required: true, message: t('validation.required') },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve();
                return Promise.reject(new Error(t('setPassword.errors.mismatch')));
              },
            }),
          ]}
        >
          <Input.Password placeholder={t('passwordPlaceholder')} />
        </Form.Item>

        <Form.Item className="mb-0">
          <Button type="primary" htmlType="submit" loading={loading} block>
            {t('setPassword.submit')}
          </Button>
        </Form.Item>
      </Form>
    </>
  );
}
