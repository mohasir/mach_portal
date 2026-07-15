'use client';
import { useState } from 'react';
import { Button, Form, Input, Modal, Select, Spin } from 'antd';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useClientsList, useCreateClient } from '@/features/clients';
import { useQuoteBuilder } from '../../hooks/useQuoteBuilder';

interface LeadFormValues {
  name: string;
  phone?: string;
}

interface ClientSectionProps {
  readOnly?: boolean;
}

export function ClientSection({ readOnly }: ClientSectionProps) {
  const { t } = useTranslation('quotes');
  const { state, setFields } = useQuoteBuilder();
  const [search, setSearch] = useState('');
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm<LeadFormValues>();
  const { createClient, isPending } = useCreateClient();

  const { data, isLoading } = useClientsList({
    page: 1,
    pageSize: 20,
    search: search || undefined,
    sortBy: 'name',
    sortDir: 'asc',
  });

  const options = (data?.items ?? []).map((c) => ({ value: c.id, label: c.name }));
  // Keep the currently selected client visible even if it falls outside the current search page.
  if (state.clientId && state.clientName && !options.some((o) => o.value === state.clientId)) {
    options.unshift({ value: state.clientId, label: state.clientName });
  }

  const handleCreate = async (values: LeadFormValues) => {
    const created = await createClient({ name: values.name, phone: values.phone });
    setFields({ clientId: created.id, clientName: created.name });
    setCreateOpen(false);
    form.resetFields();
  };

  return (
    <>
      <Form.Item label={t('builder.client.label')} required className="mb-4">
        <div className="flex items-center gap-2">
          <Select
            showSearch={{ onSearch: setSearch, filterOption: false }}
            allowClear
            disabled={readOnly}
            className="flex-1"
            placeholder={t('builder.client.placeholder')}
            value={state.clientId ?? undefined}
            notFoundContent={isLoading ? <Spin size="small" /> : null}
            options={options}
            onChange={(value, option) => {
              const label = Array.isArray(option)
                ? undefined
                : (option?.label as string | undefined);
              setFields({ clientId: value ?? null, clientName: value ? (label ?? null) : null });
            }}
          />
          {!readOnly && (
            <Button icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
              {t('builder.client.newLead')}
            </Button>
          )}
        </div>
      </Form.Item>

      <Modal
        title={t('builder.client.newLead')}
        open={isCreateOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false}>
          <Form.Item
            name="name"
            label={t('builder.client.name')}
            rules={[{ required: true, message: t('validation.clientRequired') }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="phone" label={t('builder.client.phone')}>
            <Input />
          </Form.Item>
          <Form.Item className="mb-0">
            <Button type="primary" htmlType="submit" loading={isPending} block>
              {t('form.save')}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
