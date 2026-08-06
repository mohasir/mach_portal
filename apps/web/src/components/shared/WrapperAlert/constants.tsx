import type { ReactNode } from 'react';
import {
  TbAlertSquareRoundedFilled,
  TbAlertTriangleFilled,
  TbCircleCheckFilled,
  TbHelpSquareRoundedFilled,
  TbInfoSquareRoundedFilled,
} from 'react-icons/tb';
import type { AlertColorSet, WrapperAlertIconType, WrapperAlertType } from './types';

export const TYPE_ICONS: Record<WrapperAlertIconType, ReactNode> = {
  help: <TbHelpSquareRoundedFilled size={20} />,
  success: <TbCircleCheckFilled size={20} />,
  info: <TbInfoSquareRoundedFilled size={20} />,
  warning: <TbAlertTriangleFilled size={20} />,
  error: <TbAlertSquareRoundedFilled size={20} />,
};

export const DEFAULT_ICON_BY_TYPE: Record<WrapperAlertType, WrapperAlertIconType> = {
  primary: 'help',
  success: 'success',
  info: 'info',
  warning: 'warning',
  error: 'error',
};

export const TITLE_TEXT_CLASS = 'text-[#080705]';
export const DESCRIPTION_TEXT_CLASS = 'text-gray-600';

export const ALERT_COLORS: Record<WrapperAlertType, AlertColorSet> = {
  primary: {
    bg: 'bg-primary/10',
    border: 'border-primary/40',
    buttonBg: 'bg-primary',
    buttonText: 'text-white',
    close: 'bg-primary/20 hover:bg-primary/40',
    iconColor: 'text-primary',
  },
  success: {
    bg: 'bg-success/10',
    border: 'border-success/40',
    buttonBg: 'bg-success',
    buttonText: 'text-white',
    close: 'bg-success/20 hover:bg-success/40',
    iconColor: 'text-success',
  },
  info: {
    bg: 'bg-info/10',
    border: 'border-info/40',
    buttonBg: 'bg-info',
    buttonText: 'text-white',
    close: 'bg-info/20 hover:bg-info/40',
    iconColor: 'text-info',
  },
  warning: {
    bg: 'bg-warning/12',
    border: 'border-warning/40',
    buttonBg: 'bg-warning',
    buttonText: 'text-white',
    close: 'bg-warning/20 hover:bg-warning/40',
    iconColor: 'text-warning',
  },
  error: {
    bg: 'bg-error/10',
    border: 'border-error/40',
    buttonBg: 'bg-error',
    buttonText: 'text-white',
    close: 'bg-error/20 hover:bg-error/40',
    iconColor: 'text-error',
  },
};
