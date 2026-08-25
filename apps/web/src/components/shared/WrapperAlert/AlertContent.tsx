import type { ReactNode } from 'react';
import { DESCRIPTION_TEXT_CLASS, TITLE_TEXT_CLASS, TYPE_ICONS } from './constants';
import type { WrapperAlertIconType } from './types';

interface AlertContentProps {
  iconType: WrapperAlertIconType;
  iconColorClass: string;
  title: ReactNode;
  description?: ReactNode;
  showIcon?: boolean;
}

export function AlertContent({
  iconType,
  iconColorClass,
  title,
  description,
  showIcon = true,
}: AlertContentProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        {showIcon && <span className={iconColorClass}>{TYPE_ICONS[iconType]}</span>}
        <span className={`text-sm font-bold ${TITLE_TEXT_CLASS}`}>{title}</span>
      </div>
      {description && (
        <div className={`text-sm leading-4.5 ${DESCRIPTION_TEXT_CLASS}`}>{description}</div>
      )}
    </div>
  );
}
