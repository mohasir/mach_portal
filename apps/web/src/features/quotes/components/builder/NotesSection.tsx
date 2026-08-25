'use client';
import { Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { useQuoteBuilder } from '../../hooks/useQuoteBuilder';

interface NotesSectionProps {
  readOnly?: boolean;
}

export function NotesSection({ readOnly }: NotesSectionProps) {
  const { t } = useTranslation('quotes');
  const { state, setFields } = useQuoteBuilder();

  return (
    <WrapperCard title={t('builder.event.notes')}>
      <Form layout="vertical" disabled={readOnly}>
        <Form.Item className="mb-0">
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 4 }}
            placeholder={t('builder.event.notesPlaceholder')}
            value={state.notes}
            onChange={(e) => setFields({ notes: e.target.value })}
          />
        </Form.Item>
      </Form>
    </WrapperCard>
  );
}
