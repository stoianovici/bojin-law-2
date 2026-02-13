'use client';

/**
 * NotificationTile Component
 *
 * Renders a single notification in the Flipboard-style tile format.
 * Adapts to size (large/medium/small) with different layouts:
 * - Large: Hero image + text overlay
 * - Medium: Compact card with icon
 * - Small: Minimal text-only card
 */

import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Mail,
  CheckSquare,
  FileText,
  Calendar,
  Briefcase,
  AlertTriangle,
  Bell,
  Sparkles,
} from 'lucide-react';
import { EnrichmentStatus } from '@/hooks/useFlipboardBriefing';
import { TileSize, TILE_SIZE_CLASSES } from './layouts';
import { useImagePreload, PRIORITY_GRADIENTS } from '@/hooks/useImagePreload';

// ============================================
// Types
// ============================================

export interface NotificationTileProps {
  id: string;
  headline: string;
  summary: string;
  imageUrl?: string;
  priority: 'featured' | 'secondary';
  originalTitle: string;
  action?: {
    type: string;
    entityId?: string;
    caseId?: string;
  };
  createdAt: Date | string;
  read: boolean;
  enrichmentStatus: EnrichmentStatus;
  size: TileSize;
  gridArea: string;
  onTap: () => void;
}

// ============================================
// Icon Mapping
// ============================================

const ACTION_ICONS: Record<string, React.ReactNode> = {
  open_email: <Mail className="h-4 w-4" />,
  open_task: <CheckSquare className="h-4 w-4" />,
  open_document: <FileText className="h-4 w-4" />,
  open_calendar: <Calendar className="h-4 w-4" />,
  open_case: <Briefcase className="h-4 w-4" />,
  open_inbox: <Bell className="h-4 w-4" />,
};

function getActionIcon(actionType?: string): React.ReactNode {
  if (!actionType) return <Bell className="h-4 w-4" />;
  return ACTION_ICONS[actionType] || <Bell className="h-4 w-4" />;
}

// ============================================
// Time Formatting
// ============================================

function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'acum';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}z`;
  return then.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

// ============================================
// Component
// ============================================

export function NotificationTile({
  id,
  headline,
  summary,
  imageUrl,
  priority,
  originalTitle,
  action,
  createdAt,
  read,
  enrichmentStatus,
  size,
  gridArea,
  onTap,
}: NotificationTileProps) {
  const isFeatured = priority === 'featured';
  const isLarge = size === 'large';
  const isMedium = size === 'medium';
  const isPending = enrichmentStatus === 'PENDING';

  // Preload image for large tiles
  const imageState = useImagePreload(isLarge ? imageUrl : undefined);
  const showImage = isLarge && imageUrl && imageState === 'loaded';
  const showFallbackGradient = isLarge && imageUrl && imageState === 'error';

  return (
    <motion.button
      className={clsx(
        'relative w-full rounded-xl overflow-hidden text-left',
        'bg-bg-card border border-border',
        'active:scale-[0.98] transition-transform',
        TILE_SIZE_CLASSES[size],
        // Unread indicator
        !read && 'ring-2 ring-accent/30',
        // Fallback gradient when image fails to load
        showFallbackGradient && PRIORITY_GRADIENTS[priority]
      )}
      style={{ gridArea }}
      onClick={onTap}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1 }}
    >
      {/* Background image for large tiles (only when loaded) */}
      {showImage && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${imageUrl})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        </div>
      )}

      {/* Content */}
      <div className={clsx('relative h-full flex flex-col', showImage ? 'justify-end p-4' : 'p-4')}>
        {/* Top row: Icon + Time */}
        <div className="flex items-center justify-between mb-2">
          <div
            className={clsx(
              'flex items-center justify-center rounded-lg',
              showImage
                ? 'h-8 w-8 bg-white/20 text-white'
                : isFeatured
                  ? 'h-8 w-8 bg-accent/10 text-accent'
                  : 'h-7 w-7 bg-bg-elevated text-text-tertiary'
            )}
          >
            {getActionIcon(action?.type)}
          </div>

          <span className={clsx('text-xs', showImage ? 'text-white/70' : 'text-text-tertiary')}>
            {formatTimeAgo(createdAt)}
          </span>
        </div>

        {/* Priority badge for featured (non-image) */}
        {isFeatured && !showImage && (
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-3 w-3 text-warning" />
            <span className="text-[10px] font-medium text-warning uppercase tracking-wider">
              Important
            </span>
          </div>
        )}

        {/* Headline */}
        <h3
          className={clsx(
            'font-semibold leading-tight',
            isLarge
              ? showImage
                ? 'text-lg text-white mb-2'
                : 'text-base text-text-primary mb-2'
              : isMedium
                ? 'text-sm text-text-primary mb-1 line-clamp-2'
                : 'text-sm text-text-primary line-clamp-1'
          )}
        >
          {headline}
        </h3>

        {/* Summary - only for large and medium tiles */}
        {(isLarge || isMedium) && (
          <p
            className={clsx(
              'leading-relaxed',
              isLarge
                ? showImage
                  ? 'text-sm text-white/80 line-clamp-2'
                  : 'text-sm text-text-secondary line-clamp-3'
                : 'text-xs text-text-tertiary line-clamp-2'
            )}
          >
            {summary}
          </p>
        )}

        {/* Unread dot */}
        {!read && !isPending && (
          <div className="absolute top-3 right-3">
            <div className="h-2 w-2 rounded-full bg-accent" />
          </div>
        )}

        {/* Processing indicator for pending enrichment */}
        {isPending && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-bg-elevated/80 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-accent animate-pulse" />
            <span className="text-[10px] text-text-tertiary">Procesare...</span>
          </div>
        )}
      </div>
    </motion.button>
  );
}
