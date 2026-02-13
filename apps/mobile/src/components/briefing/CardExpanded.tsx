'use client';

/**
 * CardExpanded Component
 *
 * Full-screen expansion view for Flipboard tiles.
 * Uses position-based animation: captures source tile rect,
 * animates from tile position to full-screen.
 *
 * Features:
 * - Card morphs from tile position to full viewport
 * - Swipe up OR down to dismiss
 * - Content fades in after expansion
 * - Spring animation for natural feel
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { clsx } from 'clsx';
import {
  X,
  ChevronRight,
  Mail,
  CheckSquare,
  FileText,
  Calendar,
  Phone,
  Clock,
  ExternalLink,
  Bell,
  Newspaper,
  Briefcase,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui';
import {
  type FlipboardItem,
  type FlipboardAction,
  type FlipboardCategory,
  type FlipboardActionType,
} from '@/hooks/useFlipboardBriefing';
import { SPRING_CONFIG } from './usePageFlip';

// ============================================
// Types
// ============================================

export interface SourceRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface CardExpandedProps {
  open: boolean;
  onClose: () => void;
  item: FlipboardItem | null;
  sourceRect: SourceRect | null;
  onExecuteAction: (
    itemId: string,
    actionId: string,
    actionType?: FlipboardActionType
  ) => Promise<boolean>;
  onDismiss: (itemId: string) => Promise<boolean>;
}

// ============================================
// Constants
// ============================================

const DRAG_THRESHOLD = 100;
const VELOCITY_THRESHOLD = 500;

// ============================================
// Icon Components
// ============================================

function CategoryIcon({
  category,
  className,
}: {
  category: FlipboardCategory;
  className?: string;
}) {
  switch (category) {
    case 'PENDING_ACTION':
      return <CheckSquare className={className} />;
    case 'ALERT':
      return <Bell className={className} />;
    case 'NEWS':
      return <Newspaper className={className} />;
    default:
      return <Briefcase className={className} />;
  }
}

function ActionIcon({ type, className }: { type: FlipboardActionType; className?: string }) {
  switch (type) {
    case 'VIEW_EMAIL':
    case 'REPLY_EMAIL':
      return <Mail className={className} />;
    case 'VIEW_DOCUMENT':
    case 'DRAFT_DOCUMENT':
      return <FileText className={className} />;
    case 'CREATE_TASK':
    case 'COMPLETE_TASK':
      return <CheckSquare className={className} />;
    case 'CALL_CLIENT':
      return <Phone className={className} />;
    case 'SCHEDULE':
      return <Calendar className={className} />;
    case 'SNOOZE':
      return <Clock className={className} />;
    case 'DISMISS':
      return <X className={className} />;
    case 'NAVIGATE':
    default:
      return <ExternalLink className={className} />;
  }
}

function getCategoryLabel(category: FlipboardCategory): string {
  switch (category) {
    case 'PENDING_ACTION':
      return 'De facut';
    case 'ALERT':
      return 'Atentie';
    case 'NEWS':
      return 'Noutati';
    default:
      return category;
  }
}

// ============================================
// Component
// ============================================

export function CardExpanded({
  open,
  onClose,
  item,
  sourceRect,
  onExecuteAction,
  onDismiss,
}: CardExpandedProps) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [contentVisible, setContentVisible] = useState(false);

  // Create portal container
  useEffect(() => {
    const container = document.createElement('div');
    container.id = 'card-expanded-portal';
    document.body.appendChild(container);
    setPortalContainer(container);

    return () => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  // Show content after card expands
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setContentVisible(true), 200);
      return () => clearTimeout(timer);
    } else {
      setContentVisible(false);
    }
  }, [open]);

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      const { offset, velocity } = info;
      // Close on swipe up OR down
      if (Math.abs(offset.y) > DRAG_THRESHOLD || Math.abs(velocity.y) > VELOCITY_THRESHOLD) {
        onClose();
      }
    },
    [onClose]
  );

  const handleAction = async (action: FlipboardAction) => {
    if (!item) return;

    if (action.type === 'NAVIGATE' && action.href) {
      window.location.assign(action.href);
      return;
    }

    setExecutingAction(action.id);
    const success = await onExecuteAction(item.id, action.id, action.type);
    setExecutingAction(null);

    if (success && ['COMPLETE_TASK', 'SNOOZE', 'DISMISS'].includes(action.type)) {
      onClose();
    }
  };

  const handleDismissItem = async () => {
    if (!item) return;

    setExecutingAction('dismiss');
    const success = await onDismiss(item.id);
    setExecutingAction(null);
    if (success) {
      onClose();
    }
  };

  // Only render on client with portal container
  if (typeof window === 'undefined' || !portalContainer) return null;

  const primaryAction = item?.suggestedActions.find((a) => a.isPrimary);
  const secondaryActions = item?.suggestedActions.filter((a) => !a.isPrimary) || [];

  // Calculate animation values
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 390;
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 844;

  const initialRect = sourceRect || {
    top: windowHeight / 2 - 100,
    left: 24,
    width: windowWidth - 48,
    height: 200,
  };

  return createPortal(
    <AnimatePresence>
      {open && item && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/70"
            onClick={onClose}
          />

          {/* Expanding Card */}
          <motion.div
            className="fixed z-50 bg-bg-primary overflow-hidden flex flex-col"
            style={{ willChange: 'transform, width, height, top, left, borderRadius' }}
            initial={{
              top: initialRect.top,
              left: initialRect.left,
              width: initialRect.width,
              height: initialRect.height,
              borderRadius: 12,
            }}
            animate={{
              top: 0,
              left: 0,
              width: windowWidth,
              height: windowHeight,
              borderRadius: 0,
            }}
            exit={{
              top: initialRect.top,
              left: initialRect.left,
              width: initialRect.width,
              height: initialRect.height,
              borderRadius: 12,
            }}
            transition={SPRING_CONFIG}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.3, bottom: 0.3 }}
            onDragEnd={handleDragEnd}
          >
            {/* Drag handle */}
            <div className="flex justify-center py-3 shrink-0">
              <div className="w-10 h-1 rounded-full bg-text-tertiary/30" />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-4 p-2 rounded-full bg-bg-card/80 backdrop-blur-sm z-10"
              aria-label="Inchide"
            >
              <X className="h-5 w-5 text-text-secondary" />
            </button>

            {/* Hero Section (always visible, morphs from tile) */}
            <div className="px-6 shrink-0">
              {/* Category + Badge */}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={clsx(
                    'h-10 w-10 rounded-xl flex items-center justify-center',
                    item.category === 'ALERT'
                      ? 'bg-warning/10 text-warning'
                      : item.category === 'PENDING_ACTION'
                        ? 'bg-accent/10 text-accent'
                        : 'bg-accent/10 text-accent'
                  )}
                >
                  <CategoryIcon category={item.category} className="h-5 w-5" />
                </div>
                <span className="text-xs text-text-tertiary uppercase tracking-wider">
                  {item.caseName || getCategoryLabel(item.category)}
                </span>
                {item.category === 'ALERT' && (
                  <span className="ml-auto px-2 py-0.5 rounded text-[10px] font-medium bg-warning/10 text-warning flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Atentie
                  </span>
                )}
              </div>

              {/* Headline */}
              <h2 className="text-2xl font-bold text-text-primary mb-2 leading-tight">
                {item.headline}
              </h2>
            </div>

            {/* Extended Content (fades in after expand) */}
            <motion.div
              className="flex-1 overflow-y-auto px-6 pb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: contentVisible ? 1 : 0 }}
              transition={{ duration: 0.15 }}
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 24px)' }}
            >
              {/* Summary */}
              <p className="text-base text-text-secondary leading-relaxed mb-6">{item.summary}</p>

              {/* Metadata */}
              {(item.dueDate || item.actorName) && (
                <div className="flex flex-wrap gap-4 mb-6 text-sm text-text-tertiary">
                  {item.dueDate && (
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {new Date(item.dueDate).toLocaleDateString('ro-RO', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  )}
                  {item.actorName && (
                    <span className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {item.actorName}
                    </span>
                  )}
                </div>
              )}

              {/* Secondary Actions */}
              {secondaryActions.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                    Actiuni disponibile
                  </h3>
                  <div className="space-y-2">
                    {secondaryActions.map((action) => (
                      <button
                        key={action.id}
                        className={clsx(
                          'flex items-center gap-3 w-full p-4 rounded-xl',
                          'bg-bg-card border border-border',
                          'active:bg-bg-hover transition-colors',
                          executingAction === action.id && 'opacity-50'
                        )}
                        onClick={() => handleAction(action)}
                        disabled={executingAction !== null}
                      >
                        <ActionIcon type={action.type} className="h-5 w-5 text-text-secondary" />
                        <span className="flex-1 text-sm text-text-primary text-left font-medium">
                          {action.label}
                        </span>
                        <ChevronRight className="h-4 w-4 text-text-tertiary" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Primary Action */}
              {primaryAction && (
                <Button
                  fullWidth
                  size="lg"
                  onClick={() => handleAction(primaryAction)}
                  loading={executingAction === primaryAction.id}
                  disabled={executingAction !== null}
                  className="mb-3"
                >
                  {primaryAction.label}
                </Button>
              )}

              {/* Dismiss button */}
              <Button
                variant="ghost"
                fullWidth
                onClick={handleDismissItem}
                loading={executingAction === 'dismiss'}
                disabled={executingAction !== null}
              >
                Ignora
              </Button>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    portalContainer
  );
}
