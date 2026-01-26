'use client';

import { useState } from 'react';
import Image from 'next/image';
import { clsx } from 'clsx';

// ============================================
// Types
// ============================================

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  className?: string;
}

// ============================================
// Styles
// ============================================

const sizeStyles: Record<AvatarSize, { container: string; text: string; pixels: number }> = {
  xs: { container: 'w-6 h-6', text: 'text-2xs', pixels: 24 },
  sm: { container: 'w-8 h-8', text: 'text-xs', pixels: 32 },
  md: { container: 'w-10 h-10', text: 'text-sm', pixels: 40 },
  lg: { container: 'w-12 h-12', text: 'text-base', pixels: 48 },
  xl: { container: 'w-16 h-16', text: 'text-lg', pixels: 64 },
};

// ============================================
// Helpers
// ============================================

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getColorFromName(name: string): string {
  // Generate a consistent color based on name
  const colors = [
    'bg-blue-600',
    'bg-emerald-600',
    'bg-violet-600',
    'bg-amber-600',
    'bg-rose-600',
    'bg-cyan-600',
    'bg-indigo-600',
    'bg-teal-600',
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

// ============================================
// Component
// ============================================

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const styles = sizeStyles[size];
  const showFallback = !src || imageError;

  return (
    <div
      className={clsx(
        'relative rounded-full overflow-hidden shrink-0',
        styles.container,
        showFallback && getColorFromName(name),
        className
      )}
    >
      {showFallback ? (
        <div
          className={clsx(
            'w-full h-full flex items-center justify-center',
            'font-semibold text-white',
            styles.text
          )}
        >
          {getInitials(name)}
        </div>
      ) : (
        <Image
          src={src}
          alt={name}
          width={styles.pixels}
          height={styles.pixels}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      )}
    </div>
  );
}

// ============================================
// Avatar Group
// ============================================

interface AvatarGroupProps {
  avatars: Array<{ src?: string | null; name: string }>;
  max?: number;
  size?: AvatarSize;
  className?: string;
}

export function AvatarGroup({ avatars, max = 4, size = 'sm', className }: AvatarGroupProps) {
  const visible = avatars.slice(0, max);
  const remaining = avatars.length - max;
  const styles = sizeStyles[size];

  return (
    <div className={clsx('flex -space-x-2', className)}>
      {visible.map((avatar, index) => (
        <Avatar
          key={index}
          src={avatar.src}
          name={avatar.name}
          size={size}
          className="ring-2 ring-bg-primary"
        />
      ))}
      {remaining > 0 && (
        <div
          className={clsx(
            'relative rounded-full overflow-hidden shrink-0',
            'bg-bg-hover ring-2 ring-bg-primary',
            'flex items-center justify-center',
            'font-medium text-text-secondary',
            styles.container,
            styles.text
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
