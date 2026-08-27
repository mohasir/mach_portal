import { Copy } from './Copy';

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  return (
    <div className={className}>
      <Copy />
    </div>
  );
}
