'use client';
import { Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import { useOptionMutations } from '../hooks/useOptionMutations';
import { SortableList } from './SortableList';
import { OptionRow } from './OptionRow';
import type { Option } from '../types';

interface OptionListProps {
  options: Option[];
  onEdit: (option: Option) => void;
}

export function OptionList({ options, onEdit }: OptionListProps) {
  const { t } = useTranslation('catalog');
  const { reorderOptions } = useOptionMutations();

  if (options.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('option.empty')} />;
  }

  const ids = options.map((o) => o.id);

  return (
    <SortableList ids={ids} onReorder={reorderOptions}>
      <div className="divide-line flex flex-col divide-y">
        {options.map((option) => (
          <OptionRow key={option.id} option={option} onEdit={onEdit} />
        ))}
      </div>
    </SortableList>
  );
}
