export function getInitials(name: string): string {
  const normalized = name.normalize('NFD').replace(/\p{M}/gu, '');
  const words = normalized
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0]![0]!.toUpperCase();
  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-brown text-ivory',
  'bg-mustard text-foreground',
  'bg-olive text-ivory',
  'bg-ivory text-foreground',
  'bg-red text-ivory',
  'bg-salmon text-ivory',
  'bg-cocoa text-ivory',
  'bg-terracotta text-ivory',
  'bg-copper text-ivory',
  'bg-honey text-ivory',
  'bg-moss text-ivory',
  'bg-sage text-ivory',
  'bg-slate-green text-ivory',
  'bg-teal text-ivory',
  'bg-violet-gray text-ivory',
  'bg-mauve text-ivory',
] as const;

export function getAvatarColor(initials: string): string {
  let hash = 0;
  for (let i = 0; i < initials.length; i++) hash = (hash * 31 + initials.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}
