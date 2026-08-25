'use client';
import { Form, type FormInstance } from 'antd';

export function useIsFormUnchanged<T extends object>(
  form: FormInstance<T>,
  initialValues: T | undefined,
) {
  const values = Form.useWatch([], form) as T | undefined;
  if (!initialValues) return true;
  const merged = values ? { ...initialValues, ...values } : initialValues;
  return JSON.stringify(merged) === JSON.stringify(initialValues);
}
