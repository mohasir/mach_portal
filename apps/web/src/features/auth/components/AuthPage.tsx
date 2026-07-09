'use client';
import { useState } from 'react';
import { App, Button, Card, Flex, Form, Input, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { signIn, signUp } from '@/lib/auth/client';

type AuthInput = { name?: string; email: string; password: string };

export function AuthPage() {
  const { t } = useTranslation('auth');
  const { message } = App.useApp();
  const router = useRouter();
  const [form] = Form.useForm<AuthInput>();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: AuthInput) => {
    setLoading(true);
    try {
      const res =
        mode === 'signup'
          ? await signUp.email({ name: values.name ?? values.email, email: values.email, password: values.password })
          : await signIn.email({ email: values.email, password: values.password });

      if (res.error) {
        message.error(res.error.message ?? t(mode === 'signup' ? 'errors.signupFailed' : 'errors.signinFailed'));
        return;
      }
      message.success(t(mode === 'signup' ? 'signupSuccess' : 'signinSuccess'));
      router.replace('/admin');
    } catch (err) {
      const isNetwork = err instanceof TypeError && err.message.includes('fetch');
      message.error(isNetwork ? t('errors.network') : t('errors.unexpected'));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    form.resetFields();
  };

  return (
    <Flex justify="center" align="center" className="min-h-screen">
      <Card className="w-full max-w-90" classNames={{ body: 'p-8' }}>
        <Typography.Title level={2} className="font-heading text-brown mb-6">
          {mode === 'signin' ? t('signinTitle') : t('signupTitle')}
        </Typography.Title>

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          {mode === 'signup' && (
            <Form.Item name="name" label={t('name')} rules={[{ required: true, message: t('validation.nameRequired') }]}>
              <Input placeholder={t('namePlaceholder')} />
            </Form.Item>
          )}

          <Form.Item
            name="email"
            label={t('email')}
            rules={[
              { required: true, message: t('validation.required') },
              { type: 'email', message: t('validation.email') },
            ]}
          >
            <Input type="email" placeholder={t('emailPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="password"
            label={t('password')}
            rules={[
              { required: true, message: t('validation.required') },
              { min: 8, message: t('validation.passwordMin') },
            ]}
          >
            <Input.Password placeholder={t('passwordPlaceholder')} />
          </Form.Item>

          <Form.Item className="mb-0">
            <Button type="primary" htmlType="submit" loading={loading} block>
              {mode === 'signin' ? t('signinAction') : t('signupAction')}
            </Button>
          </Form.Item>
        </Form>

        <Button type="link" onClick={switchMode} block className="text-muted mt-2 text-xs">
          {mode === 'signin' ? t('switchToSignup') : t('switchToSignin')}
        </Button>
      </Card>
    </Flex>
  );
}
