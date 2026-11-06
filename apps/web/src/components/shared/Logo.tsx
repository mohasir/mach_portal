import Image from 'next/image';

interface LogoProps {
  iconOnly?: boolean;
}

export function Logo({ iconOnly = false }: LogoProps) {
  if (iconOnly) {
    return (
      <Image
        src="/oravi-icon.svg"
        alt="OraviCloud"
        width={36}
        height={36}
        priority
        className="h-9 w-9 shrink-0"
      />
    );
  }

  return (
    <Image
      src="/LogotipoOraviCloud.svg"
      alt="OraviCloud"
      width={314}
      height={63}
      priority
      className="h-full w-full shrink-0 object-contain"
    />
  );
}
