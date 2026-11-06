'use client';
import { useEffect, useState } from 'react';
import { App, Button, Form, Input, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { broadcastSessionChange } from '@/features/tenant';
import { signIn } from '@/lib/auth/client';
import { getLoginErrorKey } from '../helpers';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';

type AuthInput = { email: string; password: string };

export function AuthPage() {
  const { t } = useTranslation('auth');
  const { message } = App.useApp();
  const router = useRouter();
  const qc = useQueryClient();
  const [form] = Form.useForm<AuthInput>();
  const [loading, setLoading] = useState(false);

  // Logout leaves the cache to this screen: clearing it while the authenticated page is still
  // mounted would refetch every active query without a session.
  useEffect(() => {
    qc.clear();
  }, [qc]);

  const onFinish = async (values: AuthInput) => {
    setLoading(true);
    try {
      const res = await signIn.email({ email: values.email, password: values.password });

      if (res.error) {
        message.error(t(getLoginErrorKey(res.error.code)));
        return;
      }
      // Nothing cached by a previous account may survive into this session.
      qc.clear();
      broadcastSessionChange('login');
      message.success(t('signinSuccess'));
      router.replace('/admin');
    } catch (err) {
      const isNetwork = err instanceof TypeError && err.message.includes('fetch');
      message.error(isNetwork ? t('errors.network') : t('errors.unexpected'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Typography.Title level={2} className="font-heading text-brown mt-10 mb-6 text-center">
        {t('signinTitle')}
      </Typography.Title>

      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item
          name="email"
          label={<FieldLabel title={t('email')} required />}
          rules={[
            { required: true, message: t('validation.required') },
            { type: 'email', message: t('validation.email') },
          ]}
        >
          <Input type="email" placeholder={t('emailPlaceholder')} />
        </Form.Item>

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

        <Form.Item className="mb-0">
          <Button type="primary" htmlType="submit" loading={loading} block>
            {t('signinAction')}
          </Button>
        </Form.Item>
      </Form>
    </>
  );
}
