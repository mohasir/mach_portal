import Image from 'next/image';
import machFavicon from '@/assets/machFavicon.webp';
import machLogo from '@/assets/machLogo.webp';

interface LogoProps {
  iconOnly?: boolean;
}

export function Logo({ iconOnly = false }: LogoProps) {
  if (iconOnly) {
    return <Image src={machFavicon} alt="Mach" priority className="h-9 w-9 shrink-0 rounded-lg" />;
  }

  return (
    <Image
      src={machLogo}
      alt="Mach Snack Bar & Drinks"
      priority
      className="h-full shrink-0 w-full object-contain"
    />
  );
}
