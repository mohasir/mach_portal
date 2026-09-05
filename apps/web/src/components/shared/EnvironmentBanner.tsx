import { TbDeviceDesktopFilled, TbFlaskFilled } from 'react-icons/tb';
import { env, showEnvBanner } from '@/env';

const COLORS_BY_ENV: Record<string, string> = {
  local: 'bg-yellow-500 text-brown/90',
  staging: 'bg-green-600 text-ivory',
};

const ICON_BY_ENV: Record<string, typeof TbFlaskFilled> = {
  local: TbDeviceDesktopFilled,
  staging: TbFlaskFilled,
};

export function EnvironmentBanner() {
  if (!showEnvBanner) return null;

  const colors = COLORS_BY_ENV[env.NEXT_PUBLIC_APP_ENV] ?? 'bg-green-600 text-ivory';
  const Icon = ICON_BY_ENV[env.NEXT_PUBLIC_APP_ENV] ?? TbFlaskFilled;

  return (
    <div
      className={`flex h-7 w-full shrink-0 items-center justify-center gap-1.5 text-xs font-medium ${colors}`}
    >
      <Icon size={14} />
      {env.NEXT_PUBLIC_APP_ENV} environment
    </div>
  );
}
