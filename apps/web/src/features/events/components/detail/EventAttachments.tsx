'use client';
import { Empty, Image } from 'antd';
import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import type { EventDetail } from '../../types';

interface EventAttachmentsProps {
  event: EventDetail;
}

export function EventAttachments({ event }: EventAttachmentsProps) {
  const { t } = useTranslation('events');
  const { dateTime } = useDateFormatter();

  const attachments = event.payments
    .flatMap((payment) => payment.attachments)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="px-4">
      {attachments.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('detail.attachments.empty')} />
      ) : (
        <div className="flex flex-col">
          {attachments.map((attachment, index) => {
            const isImage = attachment.mimeType.startsWith('image/');
            return (
              <div
                key={attachment.id}
                className={`flex items-center gap-4 py-4 ${index > 0 ? 'border-line border-t' : ''}`}
              >
                {isImage ? (
                  <Image
                    src={attachment.url}
                    alt={attachment.fileName}
                    width={48}
                    height={48}
                    className="shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                    <FileText size={22} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate font-medium hover:underline"
                  >
                    {attachment.fileName}
                  </a>
                  <div className="text-xs text-gray-500">
                    {attachment.createdByName
                      ? t('detail.attachments.sharedBy', {
                          name: attachment.createdByName,
                          date: dateTime(attachment.createdAt),
                        })
                      : dateTime(attachment.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
