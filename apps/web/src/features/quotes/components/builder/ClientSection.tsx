'use client';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { Button, Form, Input, Select, Spin, type FormInstance } from 'antd';
import { ArrowLeft, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useClientsList } from '@/features/clients';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { useQuoteBuilder, type NewClientDraft } from '../../hooks/useQuoteBuilder';

interface NewClientFormValues {
  name: string;
  phone?: string;
  email?: string;
}

interface ClientSectionProps {
  readOnly?: boolean;
}

export interface ApiFieldError {
  path: (string | number)[];
  message: string;
}

export interface ClientSectionHandle {
  setFieldErrors: (fieldErrors: ApiFieldError[]) => void;
}

export const ClientSection = forwardRef<ClientSectionHandle, ClientSectionProps>(
  function ClientSection({ readOnly }, ref) {
    const { t } = useTranslation('quotes');
    const { state, setFields } = useQuoteBuilder();
    const [search, setSearch] = useState('');
    const [form] = Form.useForm<NewClientFormValues>();

    useImperativeHandle(
      ref,
      () => ({
        setFieldErrors: (fieldErrors) => {
          const relevant = fieldErrors
            .filter((fe) => fe.path[0] === 'newClient')
            .map((fe) => ({ name: fe.path.slice(1), errors: [t(fe.message, fe.message)] }));
          if (relevant.length) (form as FormInstance).setFields(relevant);
        },
      }),
      [form, t],
    );

    const { data, isLoading } = useClientsList({
      page: 1,
      pageSize: 20,
      search: search || undefined,
      sortBy: 'name',
      sortDir: 'asc',
      nameOnly: true,
    });

    const options = (data?.items ?? []).map((c) => ({ value: c.id, label: c.name }));
    // Keep the currently selected client visible even if it falls outside the current search page.
    if (state.clientId && state.clientName && !options.some((o) => o.value === state.clientId)) {
      options.unshift({ value: state.clientId, label: state.clientName });
    }

    const startCreate = () => {
      setFields({
        clientId: null,
        clientName: null,
        newClient: { name: search, phone: '', email: '' },
      });
    };

    const backToSearch = () => setFields({ newClient: null });

    const handleNewClientChange = (changed: Partial<NewClientFormValues>) => {
      setFields({ newClient: { ...(state.newClient as NewClientDraft), ...changed } });
    };

    if (state.newClient) {
      return (
        <div className="flex flex-col gap-3">
          <Button
            type="text"
            size="small"
            className="self-start"
            disabled={readOnly}
            icon={<ArrowLeft size={14} />}
            onClick={backToSearch}
          >
            {t('builder.client.backToSearch')}
          </Button>

          <Form<NewClientFormValues>
            form={form}
            layout="vertical"
            disabled={readOnly}
            initialValues={state.newClient}
            onValuesChange={handleNewClientChange}
            requiredMark={false}
          >
            <Form.Item
              name="name"
              label={<FieldLabel title={t('builder.client.name')} required />}
              rules={[{ required: true, message: t('validation.clientRequired') }]}
            >
              <Input autoFocus />
            </Form.Item>
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Form.Item name="phone" label={<FieldLabel title={t('builder.client.phone')} />}>
                <Input />
              </Form.Item>
              <Form.Item name="email" label={<FieldLabel title={t('builder.client.email')} />}>
                <Input />
              </Form.Item>
            </div>
          </Form>
        </div>
      );
    }

    return (
      <div className="mb-4 flex flex-col gap-1">
        <FieldLabel title={t('builder.client.label')} required />
        <Select
          showSearch={{ onSearch: setSearch, filterOption: false }}
          allowClear
          disabled={readOnly}
          className="w-full"
          placeholder={t('builder.client.placeholder')}
          value={state.clientId ?? undefined}
          onInputKeyDown={(e) => {
            if (e.key === 'Enter' && !isLoading && options.length === 0) startCreate();
          }}
          notFoundContent={
            isLoading ? (
              <Spin size="small" />
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <span className="text-muted text-sm">{t('builder.client.noResults')}</span>
                <Button size="small" icon={<Plus size={14} />} onClick={startCreate}>
                  {t('builder.client.addNew')}
                </Button>
              </div>
            )
          }
          options={options}
          onChange={(value, option) => {
            const label = Array.isArray(option) ? undefined : (option?.label as string | undefined);
            setFields({
              clientId: value ?? null,
              clientName: value ? (label ?? null) : null,
              newClient: null,
            });
          }}
        />
      </div>
    );
  },
);
