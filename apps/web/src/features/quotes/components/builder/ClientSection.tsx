'use client';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Button, Card, Form, Input, Select, Spin, Typography, type FormInstance } from 'antd';
import { ArrowLeft, Plus, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useClient, useClientsList } from '@/features/clients';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { PhoneInput } from '@/components/shared/Inputs/PhoneInput';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import {
  useQuoteBuilder,
  type NewClientDraft,
  type QuoteBuilderState,
} from '../../hooks/useQuoteBuilder';

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

type MobileSheetMode = 'select' | 'create' | null;

export const ClientSection = forwardRef<ClientSectionHandle, ClientSectionProps>(
  function ClientSection({ readOnly }, ref) {
    const { t } = useTranslation('quotes');
    const { t: tc } = useTranslation('common');
    const { state, setFields } = useQuoteBuilder();
    const isDesktop = useIsDesktop();
    const [search, setSearch] = useState('');
    const [form] = Form.useForm<NewClientFormValues>();
    const [sheetMode, setSheetMode] = useState<MobileSheetMode>(null);
    const [changeOpen, setChangeOpen] = useState(false);
    // The search list only returns id+name (nameOnly) — fetch the full record for the
    // summary card's email/phone once an existing client is actually selected.
    const { data: selectedClient } = useClient(state.clientId ?? undefined);
    // Snapshot of client state right before a sheet opens, so "Cancel" can restore it.
    const snapshotRef = useRef<Pick<
      QuoteBuilderState,
      'clientId' | 'clientName' | 'newClient'
    > | null>(null);

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

    const captureSnapshot = () => {
      snapshotRef.current = {
        clientId: state.clientId,
        clientName: state.clientName,
        newClient: state.newClient,
      };
    };

    const openSelect = () => {
      captureSnapshot();
      setSheetMode('select');
    };

    const openEdit = () => {
      captureSnapshot();
      setSheetMode('create');
    };

    const cancelSheet = () => {
      if (snapshotRef.current) setFields(snapshotRef.current);
      setSheetMode(null);
    };

    const startCreate = () => {
      captureSnapshot();
      setFields({
        clientId: null,
        clientName: null,
        newClient: { name: search, phone: '', email: '' },
      });
      setSheetMode('create');
    };

    const backToSearch = () => setFields({ newClient: null });

    const handleNewClientChange = (changed: Partial<NewClientFormValues>) => {
      setFields({ newClient: { ...(state.newClient as NewClientDraft), ...changed } });
    };

    const selectClient = (value?: string, label?: string) => {
      setFields({
        clientId: value ?? null,
        clientName: value ? (label ?? null) : null,
        newClient: null,
      });
      setSheetMode(null);
    };

    if (!isDesktop) {
      const hasClient = !!state.clientId || !!state.newClient;
      const sheetTitle =
        sheetMode === 'create' ? t('builder.client.addNew') : t('builder.client.label');

      return (
        <div>
          <Card size="small">
            <div className="mb-3 flex items-center justify-between gap-2">
              <Typography.Title level={4} className="font-heading text-brown m-0!">
                {t('builder.client.label')}
              </Typography.Title>
              {hasClient && !readOnly && (
                <Button
                  type="link"
                  size="small"
                  className="shrink-0 px-0"
                  onClick={() => setChangeOpen(true)}
                >
                  {t('builder.client.change')}
                </Button>
              )}
            </div>

            {hasClient ? (
              <AvatarUser
                name={state.newClient?.name || state.clientName || ''}
                email={state.newClient?.email || selectedClient?.email || undefined}
                extra={
                  state.newClient?.phone || selectedClient?.phone ? (
                    <Typography.Text type="secondary" className="block truncate text-xs">
                      {state.newClient?.phone || selectedClient?.phone}
                    </Typography.Text>
                  ) : undefined
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={openSelect}
                  className="border-line flex items-center justify-center gap-2 rounded-xl border border-dashed p-2.5 text-gray-400"
                >
                  <Users size={16} />
                  <span className="text-sm">{t('builder.client.selectExisting')}</span>
                </button>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={startCreate}
                  className="border-line flex items-center justify-center gap-2 rounded-xl border border-dashed p-2.5 text-gray-400"
                >
                  <Plus size={16} />
                  <span className="text-sm">{t('builder.client.addNew')}</span>
                </button>
              </div>
            )}
          </Card>

          <BottomSheet open={sheetMode !== null} onClose={cancelSheet} title={sheetTitle}>
            {sheetMode === 'select' && (
              <div className="flex flex-col gap-3 p-4">
                <Select
                  autoFocus
                  showSearch={{ onSearch: setSearch, filterOption: false }}
                  allowClear
                  className="w-full"
                  placeholder={t('builder.client.placeholder')}
                  value={state.clientId ?? undefined}
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
                    const label = Array.isArray(option)
                      ? undefined
                      : (option?.label as string | undefined);
                    selectClient(value, label);
                  }}
                />
                <Button block onClick={cancelSheet}>
                  {tc('cancel')}
                </Button>
              </div>
            )}

            {sheetMode === 'create' && (
              <Form<NewClientFormValues>
                form={form}
                layout="vertical"
                initialValues={state.newClient ?? undefined}
                onValuesChange={handleNewClientChange}
                requiredMark={false}
                className="flex flex-col gap-1 p-4"
              >
                <Form.Item
                  name="name"
                  label={<FieldLabel title={t('builder.client.name')} required />}
                  rules={[{ required: true, message: t('validation.clientRequired') }]}
                >
                  <Input autoFocus />
                </Form.Item>
                <Form.Item name="phone" label={<FieldLabel title={t('builder.client.phone')} />}>
                  <PhoneInput />
                </Form.Item>
                <Form.Item name="email" label={<FieldLabel title={t('builder.client.email')} />}>
                  <Input />
                </Form.Item>
                <div className="flex gap-2">
                  <Button block onClick={cancelSheet}>
                    {tc('cancel')}
                  </Button>
                  <Button
                    type="primary"
                    block
                    onClick={() => {
                      form
                        .validateFields()
                        .then(() => setSheetMode(null))
                        .catch(() => {});
                    }}
                  >
                    {t('builder.client.done')}
                  </Button>
                </div>
              </Form>
            )}
          </BottomSheet>

          <BottomSheet
            open={changeOpen}
            onClose={() => setChangeOpen(false)}
            title={t('builder.client.change')}
          >
            <div className="flex flex-col gap-2 p-4">
              <Button
                block
                onClick={() => {
                  setChangeOpen(false);
                  openSelect();
                }}
              >
                {state.newClient
                  ? t('builder.client.changeSelectOne')
                  : t('builder.client.changeSelectAnother')}
              </Button>
              <Button
                block
                onClick={() => {
                  setChangeOpen(false);
                  if (state.newClient) {
                    openEdit();
                  } else {
                    startCreate();
                  }
                }}
              >
                {state.newClient ? t('builder.client.editClient') : t('builder.client.addNew')}
              </Button>
            </div>
          </BottomSheet>
        </div>
      );
    }

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
                <PhoneInput />
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
