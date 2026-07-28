'use client';
import { Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { useQuoteBuilder } from '../../hooks/useQuoteBuilder';

interface NotesSectionProps {
  readOnly?: boolean;
}

export function NotesSection({ readOnly }: NotesSectionProps) {
  const { t } = useTranslation('quotes');
  const { state, setFields } = useQuoteBuilder();

  return (
    <Form layout="vertical" disabled={readOnly}>
      <Form.Item label={<FieldLabel title={t('builder.event.notes')} />} className="mb-0">
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 4 }}
          placeholder={t('builder.event.notesPlaceholder')}
          value={state.notes}
          onChange={(e) => setFields({ notes: e.target.value })}
        />
      </Form.Item>
    </Form>
  );
}
