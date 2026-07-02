'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Input } from '@repo/ui';
import { signIn, signUp } from '@/lib/auth/client';

const authSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').optional(),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});
type AuthInput = z.infer<typeof authSchema>;

export function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AuthInput, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, getValues } = useForm<AuthInput>({
    defaultValues: { email: '', password: '', name: '' },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    const result = authSchema.safeParse(getValues());

    if (!result.success) {
      const errs: Partial<Record<keyof AuthInput, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof AuthInput;
        if (key) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const data = result.data;
      if (mode === 'signup') {
        const res = await signUp.email({
          name: data.name ?? data.email,
          email: data.email,
          password: data.password,
        });
        if (res.error) setApiError(res.error.message ?? 'Error al registrar');
      } else {
        const res = await signIn.email({ email: data.email, password: data.password });
        if (res.error) setApiError(res.error.message ?? 'Credenciales inválidas');
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setApiError(null);
    setFieldErrors({});
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-lg border p-8">
        <h1 className="text-xl font-bold">
          {mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-1">
              <Input {...register('name')} placeholder="Nombre" />
              {fieldErrors.name && (
                <p className="text-xs text-destructive">{fieldErrors.name}</p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Input {...register('email')} type="email" placeholder="Email" />
            {fieldErrors.email && (
              <p className="text-xs text-destructive">{fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-1">
            <Input
              {...register('password')}
              type="password"
              placeholder="Contraseña (mín. 8 chars)"
            />
            {fieldErrors.password && (
              <p className="text-xs text-destructive">{fieldErrors.password}</p>
            )}
          </div>

          {apiError && <p className="text-sm text-destructive">{apiError}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? '...' : mode === 'signin' ? 'Entrar' : 'Registrarse'}
          </Button>
        </form>

        <button
          type="button"
          onClick={switchMode}
          className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {mode === 'signin' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Entrá'}
        </button>
      </div>
    </div>
  );
}
