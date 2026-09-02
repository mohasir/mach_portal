import type { ReactNode } from 'react';

export type WrapperAlertType = 'primary' | 'success' | 'info' | 'warning' | 'error';

export type WrapperAlertIconType = 'success' | 'help' | 'info' | 'warning' | 'error';

export interface AlertColorSet {
  bg: string;
  border: string;
  buttonBg: string;
  buttonText: string;
  close: string;
  iconColor: string;
}

export interface WrapperAlertProps {
  type?: WrapperAlertType;
  icon?: WrapperAlertIconType;
  title?: ReactNode;
  description?: ReactNode;
  showIcon?: boolean;
  closeable?: boolean;
  onClose?: () => void;
  className?: string;
  actionText?: ReactNode;
  onAction?: () => void;
}
