'use client';
import { Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
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
        <Form.Item
          label={<FieldLabel title={t('builder.event.internalNotesLabel')} />}
          className="mb-4"
        >
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 4 }}
            placeholder={t('builder.event.internalNotesPlaceholder')}
            value={state.notes}
            onChange={(e) => setFields({ notes: e.target.value })}
          />
        </Form.Item>
        <Form.Item
          label={
            <FieldLabel
              title={t('builder.event.clientNotesLabel')}
              caption={t('builder.event.clientNotesCaption')}
            />
          }
          className="mb-0"
        >
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 4 }}
            placeholder={t('builder.event.clientNotesPlaceholder')}
            value={state.clientNotes}
            onChange={(e) => setFields({ clientNotes: e.target.value })}
          />
        </Form.Item>
      </Form>
    </WrapperCard>
  );
}
