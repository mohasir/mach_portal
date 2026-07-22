'use client';
import { Form, type FormInstance } from 'antd';

/** True while the form's current values match `initialValues` — disables Save until something actually changes. */
export function useIsFormUnchanged<T extends object>(
  form: FormInstance<T>,
  initialValues: T | undefined,
) {
  const values = Form.useWatch([], form) as T | undefined;
  if (!initialValues) return true;
  return JSON.stringify(values ?? initialValues) === JSON.stringify(initialValues);
}
