'use client';
import { useState } from 'react';
import { App, Button, Card, Flex, Form, Input, Typography } from 'antd';
import { signIn, signUp } from '@/lib/auth/client';

type AuthInput = { name?: string; email: string; password: string };

export function AuthPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<AuthInput>();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: AuthInput) => {
    setLoading(true);
    try {
      if (mode === 'signup') {
        const res = await signUp.email({
          name: values.name ?? values.email,
          email: values.email,
          password: values.password,
        });
        if (res.error) message.error(res.error.message ?? 'Error al registrar');
        else message.success('Cuenta creada exitosamente');
      } else {
        const res = await signIn.email({ email: values.email, password: values.password });
        if (res.error) message.error(res.error.message ?? 'Credenciales inválidas');
        else message.success('Sesión iniciada');
      }
    } catch (err) {
      const isNetwork = err instanceof TypeError && err.message.includes('fetch');
      message.error(isNetwork ? 'No se pudo conectar con el servidor' : (err instanceof Error ? err.message : 'Error inesperado'));
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
          {mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
        </Typography.Title>

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          {mode === 'signup' && (
            <Form.Item name="name" label="Nombre" rules={[{ required: true, message: 'Nombre requerido' }]}>
              <Input placeholder="Tu nombre" />
            </Form.Item>
          )}

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Campo requerido' },
              { type: 'email', message: 'Email inválido' },
            ]}
          >
            <Input type="email" placeholder="correo@ejemplo.com" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Contraseña"
            rules={[
              { required: true, message: 'Campo requerido' },
              { min: 8, message: 'Mínimo 8 caracteres' },
            ]}
          >
            <Input.Password placeholder="Mínimo 8 caracteres" />
          </Form.Item>

          <Form.Item className="mb-0">
            <Button type="primary" htmlType="submit" loading={loading} block>
              {mode === 'signin' ? 'Entrar' : 'Registrarse'}
            </Button>
          </Form.Item>
        </Form>

        <Button type="link" onClick={switchMode} block className="mt-2 text-muted text-xs">
          {mode === 'signin' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Entrá'}
        </Button>
      </Card>
    </Flex>
  );
}
