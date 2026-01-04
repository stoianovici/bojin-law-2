/**
 * MobileHome Component
 * OPS-298: Mobile Home - Fresh Build
 * OPS-304: MobileHome Sectioned Feed Integration
 * OPS-305: Removed embedded assistant bar (now using FAB)
 * OPS-308: Newspaper brief integration - replaced cards with typography-first layout
 * OPS-313: Briefing + Masthead Integration - added user avatar and MobileBriefing
 *
 * Main mobile home screen with personalized briefing and activity feed:
 * - Masthead with date and user avatar (opens drawer on tap)
 * - MobileBriefing section at top (AI summary, deadlines, tasks)
 * - "Activitate Recentă" section with grouped BriefRow items
 * - Pull-to-refresh on entire content area
 */

'use client';

import React, { useState, useCallback } from 'react';
import { RefreshCw, Inbox, ArrowDown, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { MobileDrawer } from './MobileDrawer';
import { MobileBriefing } from './MobileBriefing';
import { SectionHeading } from './SectionHeading';
import { BriefRow, BriefRowSkeleton } from './BriefRow';
import { useAuth } from '../../contexts/AuthContext';
import { useSetAIContext } from '../../contexts/AIAssistantContext';
import { useEdgeSwipe } from '../../hooks/useSwipeGesture';
import { usePullToRefresh, type PullState } from '../../hooks/usePullToRefresh';
import { useGroupedBriefFeed } from '../../hooks/useGroupedBriefFeed';
import type { BriefItem } from '../../hooks/useBriefFeed';
import { useRouter } from 'next/navigation';

export function MobileHome() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const router = useRouter();

  // Set AI assistant context to dashboard
  useSetAIContext('dashboard');

  // Grouped brief feed with sections
  const { sections, loading, error, hasMore, refetch, fetchMore, totalCount } = useGroupedBriefFeed(
    {
      limit: 20,
    }
  );

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  // Pull-to-refresh functionality
  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const {
    state: pullState,
    pullDistance,
    progress,
    containerRef,
    containerProps,
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    enabled: !loading && totalCount > 0,
  });

  // Handle scroll to load more
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      const isNearBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;

      if (isNearBottom && hasMore && !loading) {
        fetchMore();
      }
    },
    [hasMore, loading, fetchMore]
  );

  // Enable swipe from left edge to open drawer
  useEdgeSwipe(openDrawer, !isDrawerOpen);

  // Handle Brief item tap - navigate to relevant page
  const handleItemTap = useCallback(
    (item: BriefItem) => {
      if (item.entityType === 'Email' && item.caseId) {
        router.push(`/cases/${item.caseId}?tab=communications`);
      } else if (item.entityType === 'Document' && item.caseId) {
        router.push(`/cases/${item.caseId}?tab=documents`);
      } else if (item.caseId) {
        router.push(`/cases/${item.caseId}`);
      }
    },
    [router]
  );

  // Render error state
  if (error && totalCount === 0) {
    return (
      <div className="min-h-screen bg-linear-bg-primary flex flex-col">
        <Masthead onMenuClick={openDrawer} />
        <MobileDrawer isOpen={isDrawerOpen} onClose={closeDrawer} />
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <AlertCircle className="w-12 h-12 text-linear-error mb-4" />
          <p className="text-linear-text-secondary text-center mb-4">
            Nu am putut încărca activitatea recentă
          </p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-linear-accent text-white rounded-lg hover:bg-linear-accent-hover transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Încearcă din nou
          </button>
        </main>
      </div>
    );
  }

  // Render loading skeleton (initial load)
  if (loading && totalCount === 0) {
    return (
      <div className="min-h-screen bg-linear-bg-primary flex flex-col">
        <Masthead onMenuClick={openDrawer} />
        <MobileDrawer isOpen={isDrawerOpen} onClose={closeDrawer} />
        <main className="flex-1 overflow-y-auto">
          <BriefRowSkeleton />
          <BriefRowSkeleton />
          <BriefRowSkeleton />
          <BriefRowSkeleton />
          <BriefRowSkeleton />
        </main>
      </div>
    );
  }

  // Render empty state
  if (!loading && sections.length === 0) {
    return (
      <div className="min-h-screen bg-linear-bg-primary flex flex-col">
        <Masthead onMenuClick={openDrawer} />
        <MobileDrawer isOpen={isDrawerOpen} onClose={closeDrawer} />
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-16 h-16 bg-linear-bg-tertiary rounded-full flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8 text-linear-text-muted" />
          </div>
          <p className="text-linear-text-secondary text-center font-medium">
            Nicio activitate recentă
          </p>
          <p className="text-sm text-linear-text-muted text-center mt-1">
            Activitatea din dosare va apărea aici
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-bg-primary flex flex-col">
      <Masthead onMenuClick={openDrawer} />
      <MobileDrawer isOpen={isDrawerOpen} onClose={closeDrawer} />

      {/* Main content area with newspaper-style feed */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <section
          ref={containerRef}
          className="flex-1 overflow-y-auto relative"
          onScroll={handleScroll}
          {...containerProps}
        >
          {/* Pull-to-refresh indicator */}
          <PullIndicator state={pullState} pullDistance={pullDistance} progress={progress} />

          {/* Content with briefing and feed */}
          <div
            className="transition-transform duration-200"
            style={{
              transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
            }}
          >
            {/* Morning Briefing Section */}
            <MobileBriefing />

            {/* Divider and Recent Activity Header */}
            {sections.length > 0 && (
              <div className="mt-2">
                <div className="px-4 py-2">
                  <div className="border-t border-linear-border-subtle" />
                </div>
                <div className="px-4 pb-1">
                  <span className="text-xs font-semibold text-linear-text-muted uppercase tracking-wider">
                    Activitate Recentă
                  </span>
                </div>
              </div>
            )}

            {/* Grouped feed sections */}
            {sections.map((section, sectionIndex) => (
              <div key={section.key}>
                <SectionHeading
                  title={section.title}
                  count={section.count}
                  withTopMargin={sectionIndex > 0}
                />
                {section.items.map((item) => (
                  <BriefRow key={item.id} item={item} onTap={handleItemTap} />
                ))}
              </div>
            ))}

            {/* Loading more indicator */}
            {loading && totalCount > 0 && (
              <div className="flex justify-center py-4">
                <RefreshCw className="w-5 h-5 text-linear-text-muted animate-spin" />
              </div>
            )}

            {/* End of list */}
            {!hasMore && totalCount > 0 && (
              <div className="text-center py-4 text-sm text-linear-text-muted">
                Acesta este tot pentru ultimele 7 zile
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

// ============================================================================
// Masthead Component - Date header with user avatar for drawer access
// ============================================================================

interface MastheadProps {
  onMenuClick: () => void;
}

function Masthead({ onMenuClick }: MastheadProps) {
  const { user } = useAuth();
  const dateStr = format(new Date(), 'EEE d MMM', { locale: ro });
  // Capitalize first letter of day name
  const formattedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : 'U';

  return (
    <div className="px-4 pt-6 pb-2 flex items-center justify-between">
      <span className="text-xs font-semibold text-linear-text-muted uppercase tracking-wider">
        Rezumat · {formattedDate}
      </span>
      <button
        onClick={onMenuClick}
        className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform"
        style={{
          background: 'linear-gradient(135deg, #5E6AD2, #6B76DC)',
        }}
        aria-label="Deschide meniu"
      >
        <span className="text-white text-sm font-medium">{initials}</span>
      </button>
    </div>
  );
}

// ============================================================================
// Pull Indicator Component
// ============================================================================

interface PullIndicatorProps {
  state: PullState;
  pullDistance: number;
  progress: number;
}

function PullIndicator({ state, pullDistance, progress }: PullIndicatorProps) {
  if (pullDistance === 0 && state === 'idle') return null;

  const isRefreshing = state === 'refreshing';
  const isReady = state === 'ready';

  return (
    <div
      className="absolute left-0 right-0 flex items-center justify-center overflow-hidden z-10"
      style={{
        height: pullDistance,
        top: 0,
      }}
    >
      <div
        className={`
          flex items-center justify-center w-10 h-10 rounded-full
          transition-all duration-200
          ${isReady || isRefreshing ? 'bg-linear-accent-muted' : 'bg-linear-bg-tertiary'}
        `}
        style={{
          opacity: Math.min(progress * 1.5, 1),
          transform: `scale(${0.5 + progress * 0.5}) rotate(${isReady ? 180 : progress * 180}deg)`,
        }}
      >
        {isRefreshing ? (
          <RefreshCw className="w-5 h-5 text-linear-accent animate-spin" />
        ) : (
          <ArrowDown
            className={`w-5 h-5 transition-colors ${isReady ? 'text-linear-accent' : 'text-linear-text-tertiary'}`}
          />
        )}
      </div>
    </div>
  );
}
