'use client';
import { useState } from 'react';
import { App, Button, Form, Result, Skeleton, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { WrapperAlert } from '@/components/shared/WrapperAlert';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { usePermissions } from '@/features/tenant';
import { useCan } from '@/lib/auth/useCan';
import { useRole, useUpdateRole } from '../hooks/useRoles';
import { ROLE_MODAL_WIDTH } from '../helpers';
import { resolveReloadError, resolveSubmitError } from '../lib/roleErrors';
import {
  buildUpdatePayload,
  editorMode,
  initialFormState,
  rebaseOnLatest,
  type RebaseResult,
  type RoleFormState,
} from '../lib/roleForm';
import { RoleForm } from './RoleForm';
import type { RoleDetail } from '../types';

interface EditRoleModalProps {
  roleId: string | null;
  open: boolean;
  onClose: () => void;
}

export function EditRoleModal({ roleId, open, onClose }: EditRoleModalProps) {
  const { t } = useTranslation('roles');
  const canUpdate = useCan()({ [RESOURCES.ROLE]: [ACTIONS.UPDATE] });
  const query = useRole(open ? roleId : null);
  const role = query.data;

  const title = role?.isOwner
    ? t('view.title')
    : canUpdate
      ? t('edit.title')
      : t('rowActions.view');

  const renderContent = () => {
    if (query.isPending) return <Skeleton active paragraph={{ rows: 8 }} />;
    if (!role) {
      return (
        <Result
          status="warning"
          title={t('form.loadError')}
          extra={<Button onClick={() => void query.refetch()}>{t('form.retry')}</Button>}
        />
      );
    }
    return (
      <EditRoleContent
        key={role.id}
        role={role}
        canUpdate={canUpdate}
        reload={query.refetch}
        onClose={onClose}
      />
    );
  };

  return (
    <WrapperModal open={open} onCancel={onClose} title={title} width={ROLE_MODAL_WIDTH}>
      {open && roleId && renderContent()}
    </WrapperModal>
  );
}

interface EditRoleContentProps {
  role: RoleDetail;
  canUpdate: boolean;
  reload: () => Promise<{ data?: RoleDetail; error: unknown; isError: boolean }>;
  onClose: () => void;
}

type ConflictState = { stage: 'detected' } | { stage: 'rebased'; diff: RebaseResult['diff'] };

function EditRoleContent({ role, canUpdate, reload, onClose }: EditRoleContentProps) {
  const { t } = useTranslation('roles');
  const { t: ta } = useTranslation('api');
  const { message } = App.useApp();
  const { access } = usePermissions();
  const [form] = Form.useForm<RoleFormState>();
  const { updateRole, isPending } = useUpdateRole(form);

  // The form only reads its initial values on mount; refetches never overwrite what is typed.
  const [initial] = useState(() => initialFormState(role));
  const [latest, setLatest] = useState<RoleDetail>(role);
  const [expectedVersion, setExpectedVersion] = useState(role.version);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [noticeCode, setNoticeCode] = useState<string | null>(null);

  // Follows the latest loaded version: a reload may bring permissions the actor lacks.
  const { locked, exceedsActor, readOnly } = editorMode(latest, canUpdate, access);

  const onSubmit = async (values: RoleFormState) => {
    setNoticeCode(null);
    try {
      await updateRole(buildUpdatePayload(role.id, expectedVersion, values));
      message.success(t('form.saved'));
      onClose();
    } catch (error) {
      const outcome = resolveSubmitError(error);
      if (outcome.kind === 'conflict') setConflict({ stage: 'detected' });
      if (outcome.kind === 'nameTaken') {
        form.setFields([{ name: 'name', errors: [ta('errors.ROLE_NAME_TAKEN')] }]);
      }
      if (outcome.kind === 'notice') setNoticeCode(outcome.code);
    }
  };

  const loadLatest = async () => {
    const result = await reload();
    if (result.isError || !result.data) {
      setNoticeCode(resolveReloadError(result.error));
      return;
    }
    const draft = form.getFieldsValue(true) as RoleFormState;
    const rebased = rebaseOnLatest(draft, result.data);
    setLatest(result.data);
    setExpectedVersion(rebased.expectedVersion);
    setConflict({ stage: 'rebased', diff: rebased.diff });
  };

  const discardDraft = () => {
    form.setFieldsValue(initialFormState(latest));
    form.setFields([{ name: 'name', errors: [] }]);
    setConflict(null);
  };

  const renderRebasedSummary = (diff: RebaseResult['diff']) => {
    const chips = [
      diff.nameChanged && t('conflict.nameChanged'),
      diff.added.length > 0 && t('conflict.added', { count: diff.added.length }),
      diff.removed.length > 0 && t('conflict.removed', { count: diff.removed.length }),
      diff.rescoped.length > 0 && t('conflict.rescoped', { count: diff.rescoped.length }),
    ].filter((chip): chip is string => !!chip);
    if (chips.length === 0) return t('conflict.rebasedNone');
    return (
      <div className="flex flex-col gap-2">
        <span>{t('conflict.rebasedDescription')}</span>
        <div className="flex flex-wrap gap-1">
          {chips.map((chip) => (
            <Tag key={chip} className="m-0">
              {chip}
            </Tag>
          ))}
        </div>
      </div>
    );
  };

  const banner = locked ? (
    <WrapperAlert type="info" closeable={false} description={t('form.lockedNotice')} />
  ) : exceedsActor ? (
    <WrapperAlert
      type="warning"
      closeable={false}
      title={t('form.exceedsTitle')}
      description={t('form.exceedsNotice')}
    />
  ) : null;

  const notices = (
    <>
      {conflict?.stage === 'detected' && (
        <WrapperAlert
          type="warning"
          closeable={false}
          title={t('conflict.title')}
          description={t('conflict.description')}
          actionText={t('conflict.reload')}
          onAction={() => void loadLatest()}
        />
      )}
      {conflict?.stage === 'rebased' && (
        <WrapperAlert
          type="info"
          closeable={false}
          title={t('conflict.rebasedTitle')}
          description={renderRebasedSummary(conflict.diff)}
          actionText={t('conflict.discard')}
          onAction={discardDraft}
        />
      )}
      {noticeCode && (
        <WrapperAlert
          key={noticeCode}
          type="error"
          onClose={() => setNoticeCode(null)}
          description={ta(`errors.${noticeCode}`, ta('errors.generic'))}
        />
      )}
    </>
  );

  return (
    <RoleForm
      form={form}
      initialValues={initial}
      actorAccess={access}
      locked={locked}
      readOnly={readOnly}
      banner={banner}
      notices={notices}
      submitDisabled={conflict?.stage === 'detected'}
      onSubmit={onSubmit}
      isPending={isPending}
    />
  );
}
