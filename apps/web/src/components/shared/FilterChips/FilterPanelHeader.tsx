'use client';
import { Button } from 'antd';
import { useTranslation } from 'react-i18next';

interface FilterPanelHeaderProps {
  title: string;
  clearDisabled: boolean;
  onClear: () => void;
}

export function FilterPanelHeader({ title, clearDisabled, onClear }: FilterPanelHeaderProps) {
  const { t } = useTranslation('common');

  return (
    <div className="flex items-center justify-between gap-4 px-4 pb-2">
      <span className="text-muted font-bold">{title}</span>
      <Button type="link" className="px-0" disabled={clearDisabled} onClick={onClear}>
        {t('filters.clearAll')}
      </Button>
    </div>
  );
}
