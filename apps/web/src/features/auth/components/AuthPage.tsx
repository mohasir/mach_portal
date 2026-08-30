'use client';
import { useState } from 'react';
import { App, Button, Flex, Form, Input, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { signIn } from '@/lib/auth/client';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { Footer } from '@/components/shared/Footer';
import { Logo } from '@/components/shared/Logo';
import { WrapperCard } from '@/components/shared/WrapperCard';

type AuthInput = { email: string; password: string };

export function AuthPage() {
  const { t } = useTranslation('auth');
  const { message } = App.useApp();
  const router = useRouter();
  const [form] = Form.useForm<AuthInput>();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: AuthInput) => {
    setLoading(true);
    try {
      const res = await signIn.email({ email: values.email, password: values.password });

      if (res.error) {
        message.error(res.error.message ?? t('errors.signinFailed'));
        return;
      }
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
      <Flex justify="center" align="center" className="min-h-dvh bg-primary/5">
        <WrapperCard className="w-full max-w-90">
          <Flex justify="center" className="h-16 my-6">
            <Logo />
          </Flex>

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
        </WrapperCard>
      </Flex>

      <Footer className="fixed inset-x-0 bottom-4" />
    </>
  );
}
