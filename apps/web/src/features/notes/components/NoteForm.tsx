'use client';
import { Button, Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CreateNoteInput } from '@repo/schemas';

interface NoteFormProps {
  initialValues?: Partial<CreateNoteInput>;
  onSubmit: (values: CreateNoteInput) => Promise<void> | void;
  isPending: boolean;
}

export function NoteForm({ initialValues, onSubmit, isPending }: NoteFormProps) {
  const { t } = useTranslation('notes');
  const [form] = Form.useForm<CreateNoteInput>();

  return (
    <Form form={form} layout="vertical" initialValues={initialValues} onFinish={onSubmit} requiredMark={false}>
      <Form.Item
        name="title"
        label={t('form.title')}
        rules={[{ required: true, message: t('validation.titleRequired') }, { max: 120 }]}
      >
        <Input placeholder={t('form.titlePlaceholder')} />
      </Form.Item>

      <Form.Item name="content" label={t('form.content')} rules={[{ max: 5000 }]}>
        <Input.TextArea rows={3} placeholder={t('form.contentPlaceholder')} />
      </Form.Item>

      <Form.Item className="mb-0">
        <Button type="primary" htmlType="submit" loading={isPending} block>
          {t('form.save')}
        </Button>
      </Form.Item>
    </Form>
  );
}
