import { useImageUrl } from '../lib/media';

type Props = {
  name: string;
  imageKey?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function ContestantAvatar({
  name,
  imageKey,
  size = 'md',
  className = '',
}: Props) {
  const url = useImageUrl(imageKey);
  const classes = ['contestant-avatar', `avatar-${size}`, className]
    .filter(Boolean)
    .join(' ');

  if (url) {
    return (
      <img
        className={classes}
        src={url}
        alt=""
        draggable={false}
      />
    );
  }

  return (
    <span className={`${classes} avatar-fallback`} aria-hidden="true">
      {initialsFor(name)}
    </span>
  );
}
