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
  'bg-navy text-sand',
  'bg-blue text-sand',
  'bg-mist text-navy',
  'bg-sand text-navy',
  'bg-navy-mid text-sand',
  'bg-sand-dark text-navy',
  'bg-blue-light text-navy',
  'bg-red text-sand',
] as const;

export function getAvatarColor(initials: string): string {
  let hash = 0;
  for (let i = 0; i < initials.length; i++) hash = (hash * 31 + initials.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}
