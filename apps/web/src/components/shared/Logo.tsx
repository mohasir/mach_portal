import { Typography } from 'antd';

interface LogoProps {
  iconOnly?: boolean;
}

export function Logo({ iconOnly = false }: LogoProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-primary font-heading flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-white">
        M
      </div>
      {!iconOnly && (
        <Typography.Text strong className="font-heading text-brown text-lg leading-none">
          Mach Portal
        </Typography.Text>
      )}
    </div>
  );
}
