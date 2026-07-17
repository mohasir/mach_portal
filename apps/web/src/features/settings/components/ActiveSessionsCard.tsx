'use client';
import { Button, Skeleton, Tag, Typography } from 'antd';
import { Monitor, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth/client';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { isMobileUserAgent, parseUserAgent } from '@/lib/utils/userAgent';
import { useActiveSessions } from '../hooks/useActiveSessions';
import { useRevokeSession } from '../hooks/useRevokeSession';
import { SettingsCard } from './SettingsCard';

export function ActiveSessionsCard() {
  const { t } = useTranslation('settings');
  const { relative } = useDateFormatter();
  const { data } = useSession();
  const currentSession = data?.session as { id?: string } | undefined;
  const { sessions, isLoading } = useActiveSessions();
  const { revokeSession, isPending } = useRevokeSession();

  return (
    <SettingsCard title={t('security.sessions.title')} caption={t('security.sessions.caption')}>
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : (
        <div className="flex flex-col">
          {sessions.map((session, index) => {
            const isCurrent = session.id === currentSession?.id;
            const Icon = isMobileUserAgent(session.userAgent) ? Smartphone : Monitor;
            const caption = [
              session.ipAddress,
              isCurrent ? t('security.sessions.activeNow') : relative(session.updatedAt),
            ]
              .filter(Boolean)
              .join(' · ');

            return (
              <div
                key={session.id}
                className={`flex items-center justify-between gap-3 py-3 ${
                  index > 0 ? 'border-line border-t' : ''
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Icon size={18} className="text-muted shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Typography.Text strong className="truncate">
                        {parseUserAgent(session.userAgent)}
                      </Typography.Text>
                      {isCurrent && <Tag color="purple">{t('security.sessions.current')}</Tag>}
                    </div>
                    <Typography.Text type="secondary" className="block truncate text-xs">
                      {caption}
                    </Typography.Text>
                  </div>
                </div>
                {!isCurrent && (
                  <Button
                    type="link"
                    danger
                    size="small"
                    loading={isPending}
                    onClick={() => void revokeSession(session.token)}
                  >
                    {t('security.sessions.revoke')}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SettingsCard>
  );
}
