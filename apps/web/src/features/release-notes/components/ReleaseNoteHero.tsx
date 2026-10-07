import type { IconType } from 'react-icons';

function Sparkle({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 0C12.9 8 16 11.1 24 12C16 12.9 12.9 16 12 24C11.1 16 8 12.9 0 12C8 11.1 11.1 8 12 0Z" />
    </svg>
  );
}

export function ReleaseNoteHero({ icon: Icon }: { icon: IconType }) {
  return (
    <div className="relative flex h-56 items-center justify-center overflow-hidden rounded-sm bg-gray-50 md:h-64">
      <Sparkle className="text-mustard absolute top-[18%] left-[20%] size-10 drop-shadow-sm" />
      <Sparkle className="text-mustard absolute top-[12%] right-[24%] size-6 drop-shadow-sm" />
      <Sparkle className="text-mustard absolute right-[18%] bottom-[20%] size-8 drop-shadow-sm" />
      <Sparkle className="text-mustard absolute bottom-[26%] left-[28%] size-4 drop-shadow-sm" />
      <div className="bg-primary/10 text-primary flex size-24 items-center justify-center rounded-3xl">
        <Icon size={48} />
      </div>
    </div>
  );
}
