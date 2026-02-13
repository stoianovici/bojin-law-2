'use client';

/**
 * FlipboardBriefing Component
 *
 * Magazine-style daily briefing using AI-generated actionable items.
 * Features:
 * - Vertical page-flip navigation (swipe up/down)
 * - 3 items per page in magazine grid layouts
 * - 6 rotating layout variants
 * - Tap tile → full-screen with details and actions
 *
 * Powered by the Flipboard Agent (Claude Haiku 3.5) for user-specific items.
 */

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Sparkles,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  AlertTriangle,
  Bell,
  Newspaper,
  Briefcase,
  CheckSquare,
} from 'lucide-react';
import { Button } from '@/components/ui';
import {
  useFlipboardBriefing,
  type FlipboardItem,
  type FlipboardAction,
  type FlipboardCategory,
} from '@/hooks/useFlipboardBriefing';
import { getLayoutVariant, TileSize, TILE_SIZE_CLASSES } from './layouts';
import { usePageFlip, SPRING_CONFIG } from './usePageFlip';
import { PageIndicator } from './PageIndicator';
import { CardExpanded, type SourceRect } from './CardExpanded';

// ============================================
// Types
// ============================================

interface FlipboardBriefingProps {
  className?: string;
}

interface FlipboardTile {
  id: string;
  headline: string;
  summary: string;
  category: FlipboardCategory;
  priority: 'FEATURED' | 'SECONDARY';
  caseName?: string;
  caseId?: string;
  dueDate?: string;
  actorName?: string;
  actions: FlipboardAction[];
  item: FlipboardItem;
}

// ============================================
// Category Icon Component
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
// Skeleton Component
// ============================================

function FlipboardSkeleton() {
  return (
    <div className="h-full flex flex-col px-6 py-4">
      <div className="flex-1 grid grid-rows-2 grid-cols-2 gap-3">
        <div className="col-span-2 rounded-xl bg-bg-card animate-pulse" />
        <div className="rounded-xl bg-bg-card animate-pulse" />
        <div className="rounded-xl bg-bg-card animate-pulse" />
      </div>
      <div className="flex justify-center py-4">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-text-tertiary/30" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Empty State Component
// ============================================

function EmptyState({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 text-center">
      <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
        <Sparkles className="h-7 w-7 text-accent" />
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1">
        Briefing-ul tau de dimineata
      </h3>
      <p className="text-sm text-text-secondary max-w-xs mb-6">
        Genereaza un briefing inteligent cu cele mai importante actiuni ale zilei.
      </p>
      <Button onClick={onRefresh} loading={refreshing} fullWidth className="max-w-[200px]">
        {refreshing ? 'Se genereaza...' : 'Genereaza briefing'}
      </Button>
    </div>
  );
}

// ============================================
// Error State Component
// ============================================

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 text-center">
      <div className="h-14 w-14 rounded-2xl bg-error/10 flex items-center justify-center mb-4">
        <AlertCircle className="h-7 w-7 text-error" />
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1">Eroare la incarcare</h3>
      <p className="text-sm text-text-secondary mb-4">Nu am putut incarca briefing-ul.</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Incearca din nou
      </Button>
    </div>
  );
}

// ============================================
// Story Tile Component
// ============================================

interface StoryTileProps {
  tile: FlipboardTile;
  size: TileSize;
  gridArea: string;
  onTap: (rect: SourceRect) => void;
}

function StoryTile({ tile, size, gridArea, onTap }: StoryTileProps) {
  const tileRef = useRef<HTMLButtonElement>(null);
  const isLarge = size === 'large';
  const isMedium = size === 'medium';
  const isAlert = tile.category === 'ALERT';
  const isPendingAction = tile.category === 'PENDING_ACTION';

  const handleTap = useCallback(() => {
    if (tileRef.current) {
      const rect = tileRef.current.getBoundingClientRect();
      onTap({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }
  }, [onTap]);

  return (
    <motion.button
      ref={tileRef}
      className={clsx(
        'relative w-full rounded-xl overflow-hidden text-left',
        'bg-bg-card border border-border',
        'active:scale-[0.98] transition-transform',
        TILE_SIZE_CLASSES[size]
      )}
      style={{ gridArea }}
      onClick={handleTap}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1 }}
    >
      <div className="relative h-full flex flex-col p-4">
        {/* Top row: Icon + Category badge */}
        <div className="flex items-center justify-between mb-2">
          <div
            className={clsx(
              'flex items-center justify-center rounded-lg',
              isAlert
                ? 'h-8 w-8 bg-warning/10 text-warning'
                : isPendingAction
                  ? 'h-8 w-8 bg-accent/10 text-accent'
                  : isLarge
                    ? 'h-8 w-8 bg-accent/10 text-accent'
                    : 'h-7 w-7 bg-bg-elevated text-text-tertiary'
            )}
          >
            <CategoryIcon category={tile.category} className="h-4 w-4" />
          </div>

          {isAlert && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-warning/10">
              <AlertTriangle className="h-3 w-3 text-warning" />
              <span className="text-[10px] font-medium text-warning uppercase">Atentie</span>
            </div>
          )}

          {isPendingAction && !isAlert && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-accent/10">
              <span className="text-[10px] font-medium text-accent uppercase">De facut</span>
            </div>
          )}
        </div>

        {/* Category label */}
        <span className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">
          {tile.caseName || getCategoryLabel(tile.category)}
        </span>

        {/* Headline */}
        <h3
          className={clsx(
            'font-semibold leading-tight text-text-primary',
            isLarge
              ? 'text-base mb-2 line-clamp-2'
              : isMedium
                ? 'text-sm mb-1 line-clamp-2'
                : 'text-sm line-clamp-1'
          )}
        >
          {tile.headline}
        </h3>

        {/* Summary - only for large and medium tiles */}
        {(isLarge || isMedium) && (
          <p
            className={clsx(
              'leading-relaxed text-text-secondary flex-1',
              isLarge ? 'text-sm line-clamp-3' : 'text-xs line-clamp-2'
            )}
          >
            {tile.summary}
          </p>
        )}

        {/* Action count indicator */}
        {tile.actions.length > 0 && (
          <div className="flex items-center justify-end mt-auto pt-2">
            <span className="text-[10px] text-text-tertiary flex items-center gap-1">
              {tile.actions.length} {tile.actions.length === 1 ? 'actiune' : 'actiuni'}
              <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        )}
      </div>
    </motion.button>
  );
}

// ============================================
// Page Component
// ============================================

interface FlipboardPageViewProps {
  page: {
    pageIndex: number;
    layoutVariant: number;
    tiles: FlipboardTile[];
  };
  onTileTap: (tile: FlipboardTile, rect: SourceRect) => void;
}

function FlipboardPageView({ page, onTileTap }: FlipboardPageViewProps) {
  const layout = getLayoutVariant(page.layoutVariant);

  return (
    <div className="h-full grid gap-3" style={{ gridTemplate: layout.gridTemplate }}>
      {page.tiles.map((tile, index) => {
        const tileConfig = layout.tiles[index];
        if (!tileConfig) return null;

        return (
          <StoryTile
            key={tile.id}
            tile={tile}
            size={tileConfig.size}
            gridArea={tileConfig.gridArea}
            onTap={(rect) => onTileTap(tile, rect)}
          />
        );
      })}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function FlipboardBriefing({ className }: FlipboardBriefingProps) {
  const {
    pages: rawPages,
    items,
    loading,
    error,
    isRefreshing,
    refresh,
    refetch,
    executeAction,
    dismissItem,
  } = useFlipboardBriefing();

  const [expandedItem, setExpandedItem] = useState<FlipboardItem | null>(null);
  const [sourceRect, setSourceRect] = useState<SourceRect | null>(null);

  // Transform pages into tile format
  const pages = rawPages.map((page) => ({
    pageIndex: page.pageIndex,
    layoutVariant: page.layoutVariant,
    tiles: page.items.map(
      (item): FlipboardTile => ({
        id: item.id,
        headline: item.headline,
        summary: item.summary,
        category: item.category,
        priority: item.priority,
        caseName: item.caseName,
        caseId: item.caseId,
        dueDate: item.dueDate,
        actorName: item.actorName,
        actions: item.suggestedActions,
        item,
      })
    ),
  }));

  const { currentPage, handleDragEnd, canGoNext, canGoPrevious, pageOpacity, pageScale } =
    usePageFlip({
      totalPages: pages.length,
      persistKey: 'flipboard_user_briefing_page',
    });

  const handleTileTap = useCallback((tile: FlipboardTile, rect: SourceRect) => {
    setSourceRect(rect);
    setExpandedItem(tile.item);
  }, []);

  const handleCloseExpanded = useCallback(() => {
    setExpandedItem(null);
    // Delay clearing sourceRect to allow exit animation
    setTimeout(() => setSourceRect(null), 400);
  }, []);

  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  // Loading state
  if (loading && items.length === 0) {
    return (
      <div className={clsx('h-full', className)}>
        <FlipboardSkeleton />
      </div>
    );
  }

  // Error state
  if (error && items.length === 0) {
    return (
      <div className={clsx('h-full', className)}>
        <ErrorState onRetry={refetch} />
      </div>
    );
  }

  // Empty state (no items generated yet)
  if (items.length === 0) {
    return (
      <div className={clsx('h-full', className)}>
        <EmptyState onRefresh={handleRefresh} refreshing={isRefreshing} />
      </div>
    );
  }

  const currentPageData = pages[currentPage];

  return (
    <div className={clsx('h-full flex flex-col', className)}>
      {/* Refreshing indicator */}
      {isRefreshing && (
        <div className="absolute top-2 right-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-card border border-border">
          <RefreshCw className="h-3 w-3 text-accent animate-spin" />
          <span className="text-[10px] text-text-secondary">Se actualizeaza...</span>
        </div>
      )}

      {/* Page Container */}
      <motion.div
        className="flex-1 px-6 py-4 overflow-hidden"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: canGoPrevious ? 0.3 : 0.1, bottom: canGoNext ? 0.3 : 0.1 }}
        onDragEnd={handleDragEnd}
        style={{
          opacity: pageOpacity,
          scale: pageScale,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={SPRING_CONFIG}
            className="h-full"
          >
            {currentPageData && (
              <FlipboardPageView page={currentPageData} onTileTap={handleTileTap} />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Page Indicator */}
      <PageIndicator totalPages={pages.length} currentPage={currentPage} className="pb-4" />

      {/* Swipe hint for first-time users */}
      {currentPage === 0 && pages.length > 1 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-xs text-text-tertiary animate-pulse">
          Trage in sus pentru mai multe
        </div>
      )}

      {/* Expanded Card */}
      <CardExpanded
        open={expandedItem !== null}
        onClose={handleCloseExpanded}
        item={expandedItem}
        sourceRect={sourceRect}
        onExecuteAction={executeAction}
        onDismiss={dismissItem}
      />
    </div>
  );
}
