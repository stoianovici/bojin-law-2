'use client';

/**
 * NotificationExpanded Component
 *
 * Full-screen view when a tile is tapped.
 * Shows complete notification details, related items, and action buttons.
 * Uses BottomSheet pattern for swipe-to-close.
 */

import { useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import {
  X,
  ChevronRight,
  Mail,
  CheckSquare,
  FileText,
  Calendar,
  Briefcase,
  User,
  ListTodo,
  StickyNote,
  Clock,
  Check,
  ExternalLink,
  Reply,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { useImagePreload, PRIORITY_GRADIENTS } from '@/hooks/useImagePreload';

// ============================================
// Types
// ============================================

interface RelatedItem {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

interface SuggestedAction {
  id: string;
  label: string;
  icon: string;
  type: string;
  payload?: Record<string, unknown>;
  href?: string;
}

export interface NotificationExpandedProps {
  open: boolean;
  onClose: () => void;
  notification: {
    id: string;
    notificationId: string;
    headline: string;
    summary: string;
    imageUrl?: string;
    priority: string;
    relatedItems: RelatedItem[];
    suggestedActions: SuggestedAction[];
    originalTitle: string;
    action?: {
      type: string;
      entityId?: string;
      caseId?: string;
    };
    createdAt: Date | string;
    read: boolean;
  } | null;
  onAction: (actionId: string, actionType?: string) => void;
}

// ============================================
// Icon Mapping
// ============================================

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Mail: Mail,
  CheckSquare: CheckSquare,
  FileText: FileText,
  Calendar: Calendar,
  Briefcase: Briefcase,
  User: User,
  ListTodo: ListTodo,
  StickyNote: StickyNote,
  Clock: Clock,
  Check: Check,
  ExternalLink: ExternalLink,
  Reply: Reply,
};

const RELATED_ITEM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  case: Briefcase,
  client: User,
  task: CheckSquare,
  email: Mail,
  document: FileText,
};

function getIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return ICON_MAP[iconName] || ExternalLink;
}

function getRelatedItemIcon(type: string): React.ComponentType<{ className?: string }> {
  return RELATED_ITEM_ICONS[type] || ExternalLink;
}

// ============================================
// Time Formatting
// ============================================

function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================
// Component
// ============================================

export function NotificationExpanded({
  open,
  onClose,
  notification,
  onAction,
}: NotificationExpandedProps) {
  const dragControls = useDragControls();
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // Preload hero image
  const heroImageState = useImagePreload(notification?.imageUrl);
  const showHeroImage = notification?.imageUrl && heroImageState === 'loaded';
  const showHeroFallback = notification?.imageUrl && heroImageState === 'error';
  const heroPriority = (notification?.priority || 'secondary') as 'featured' | 'secondary';

  // Create dedicated portal container with lifecycle cleanup
  useEffect(() => {
    const container = document.createElement('div');
    container.id = 'notification-expanded-portal';
    document.body.appendChild(container);
    setPortalContainer(container);

    return () => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };
  }, []);

  // Handle body scroll lock
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      // Close if dragged down more than 100px or with velocity
      if (info.offset.y > 100 || info.velocity.y > 500) {
        onClose();
      }
    },
    [onClose]
  );

  const handleActionClick = useCallback(
    (action: SuggestedAction) => {
      if (action.href) {
        // Navigation actions are handled by Link
        onClose();
      } else {
        // Execute action via GraphQL, pass action type for optimistic updates
        onAction(action.id, action.type);
      }
    },
    [onAction, onClose]
  );

  // Only render on client and when portal container is ready
  if (typeof window === 'undefined' || !portalContainer) return null;

  return createPortal(
    <AnimatePresence>
      {open && notification && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
            }}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            className={clsx(
              'fixed bottom-0 left-0 right-0 z-50',
              'bg-bg-elevated rounded-t-2xl',
              'shadow-xl',
              'flex flex-col',
              'max-h-[90vh]'
            )}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-title"
          >
            {/* Handle */}
            <div
              className="flex justify-center py-3 cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1 rounded-full bg-text-tertiary/50" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-4">
              <span className="text-xs text-text-tertiary">
                {formatDateTime(notification.createdAt)}
              </span>
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-lg active:bg-bg-hover transition-colors"
                aria-label="Inchide"
              >
                <X className="h-5 w-5 text-text-tertiary" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
              {/* Image - show when loaded, fallback gradient on error */}
              {(showHeroImage || showHeroFallback) && (
                <div
                  className={clsx(
                    'relative h-40 rounded-xl overflow-hidden mb-4',
                    showHeroFallback && PRIORITY_GRADIENTS[heroPriority]
                  )}
                >
                  {showHeroImage && (
                    <>
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${notification.imageUrl})` }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    </>
                  )}
                </div>
              )}

              {/* Headline */}
              <h2
                id="notification-title"
                className="text-xl font-bold text-text-primary mb-2 leading-tight"
              >
                {notification.headline}
              </h2>

              {/* Summary */}
              <p className="text-base text-text-secondary leading-relaxed mb-6">
                {notification.summary}
              </p>

              {/* Related Items */}
              {notification.relatedItems.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                    Elemente asociate
                  </h3>
                  <div className="space-y-2">
                    {notification.relatedItems.map((item) => {
                      const ItemIcon = getRelatedItemIcon(item.type);
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={onClose}
                          className={clsx(
                            'flex items-center gap-3 p-3 rounded-xl',
                            'bg-bg-card border border-border',
                            'active:bg-bg-hover transition-colors group'
                          )}
                        >
                          <div className="h-9 w-9 rounded-lg bg-bg-elevated flex items-center justify-center">
                            <ItemIcon className="h-4 w-4 text-text-tertiary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate group-active:text-accent">
                              {item.title}
                            </p>
                            {item.subtitle && (
                              <p className="text-xs text-text-tertiary truncate">{item.subtitle}</p>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-text-tertiary shrink-0" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              {notification.suggestedActions.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                    Actiuni sugerate
                  </h3>
                  <div className="flex flex-col gap-2">
                    {notification.suggestedActions.map((action, index) => {
                      const ActionIcon = getIcon(action.icon);
                      const isNavigate = action.href && action.href !== '#';

                      if (isNavigate) {
                        return (
                          <Link key={action.id} href={action.href!} onClick={onClose}>
                            <Button
                              variant={index === 0 ? 'primary' : 'secondary'}
                              fullWidth
                              leftIcon={<ActionIcon className="h-4 w-4" />}
                            >
                              {action.label}
                            </Button>
                          </Link>
                        );
                      }

                      return (
                        <Button
                          key={action.id}
                          variant={index === 0 ? 'primary' : 'secondary'}
                          fullWidth
                          leftIcon={<ActionIcon className="h-4 w-4" />}
                          onClick={() => handleActionClick(action)}
                        >
                          {action.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    portalContainer
  );
}
