'use client';

/**
 * DailyBriefing Component for Mobile
 *
 * Adapted from web's BriefingNewspaper.tsx for mobile UX.
 * - Lead: Full-width hero cards for most important items
 * - Secondary: Collapsible cards with framer-motion animations
 * - Tertiary: Compact bullet-point list
 * - Stats footer: 2-column grid (vs web's 4-column)
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Users,
  Calendar,
  Briefcase,
  User,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Button, Skeleton } from '@/components/ui';
import {
  useFirmBriefing,
  type StoryItem,
  type StoryDetail,
  type StoryCategory,
  type StoryUrgency,
  type FirmBriefingQuickStats,
} from '@/hooks/useFirmBriefing';

// ============================================
// Utilities
// ============================================

function getStatusStyles(status?: string) {
  switch (status) {
    case 'OVERDUE':
      return 'bg-error/20 text-error';
    case 'AT_RISK':
      return 'bg-warning/20 text-warning';
    case 'ON_TRACK':
      return 'bg-success/20 text-success';
    default:
      return 'bg-bg-elevated text-text-tertiary';
  }
}

function getStatusLabel(status?: string) {
  switch (status) {
    case 'OVERDUE':
      return 'Dep.';
    case 'AT_RISK':
      return 'Risc';
    case 'ON_TRACK':
      return 'OK';
    default:
      return '';
  }
}

// ============================================
// Category Icon Renderer
// ============================================

interface CategoryIconRendererProps {
  category: StoryCategory;
  className?: string;
}

function CategoryIconRenderer({ category, className }: CategoryIconRendererProps) {
  switch (category) {
    case 'CLIENT':
      return <User className={className} aria-hidden="true" />;
    case 'TEAM':
      return <Users className={className} aria-hidden="true" />;
    case 'DEADLINE':
      return <Calendar className={className} aria-hidden="true" />;
    case 'EMAIL':
      return <Briefcase className={className} aria-hidden="true" />;
    case 'CASE':
    default:
      return <Briefcase className={className} aria-hidden="true" />;
  }
}

// ============================================
// Urgency Badge (Subtle, Optional)
// ============================================

interface UrgencyBadgeProps {
  urgency?: StoryUrgency;
}

function UrgencyBadge({ urgency }: UrgencyBadgeProps) {
  if (!urgency || urgency === 'LOW') return null;

  if (urgency === 'HIGH') {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-error/10 text-error border border-error/20">
        Urgent
      </span>
    );
  }

  if (urgency === 'MEDIUM') {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-warning/10 text-warning border border-warning/20">
        Atentie
      </span>
    );
  }

  return null;
}

// ============================================
// Skeleton Component
// ============================================

function BriefingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse px-6">
      {/* Lead skeleton */}
      <div className="rounded-xl bg-bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton variant="rectangular" width={16} height={16} />
          <Skeleton variant="text" width="30%" />
        </div>
        <Skeleton variant="text" width="90%" height={24} className="mb-3" />
        <Skeleton variant="text" lines={2} />
      </div>

      {/* Secondary skeleton */}
      <div className="space-y-3">
        <Skeleton variant="text" width="40%" height={12} />
        <div className="rounded-xl bg-bg-card p-4">
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="60%" className="mt-2" />
        </div>
        <div className="rounded-xl bg-bg-card p-4">
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="text" width="50%" className="mt-2" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Lead Card Component (Full Prominence)
// ============================================

interface LeadCardProps {
  item: StoryItem;
}

function LeadCard({ item }: LeadCardProps) {
  return (
    <article className="relative p-5 rounded-xl bg-bg-card border border-border">
      {/* Category + Optional urgency badge */}
      <div className="flex items-center gap-2 mb-3">
        <CategoryIconRenderer category={item.category} className="h-4 w-4 text-text-tertiary" />
        <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium">
          {item.category.toLowerCase()}
        </span>
        <div className="ml-auto">
          <UrgencyBadge urgency={item.urgency} />
        </div>
      </div>

      {/* Headline - Large Typography */}
      <h2 className="text-xl font-bold text-text-primary mb-2 leading-tight">{item.headline}</h2>

      {/* Summary */}
      <p className="text-sm text-text-secondary leading-relaxed mb-4">{item.summary}</p>

      {/* Inline details */}
      {item.details.length > 0 && (
        <div className="space-y-2">
          {item.details.map((detail) => (
            <DetailCard key={detail.id} detail={detail} />
          ))}
        </div>
      )}
    </article>
  );
}

// ============================================
// Detail Card Component (Shared)
// ============================================

interface DetailCardProps {
  detail: StoryDetail;
}

function DetailCard({ detail }: DetailCardProps) {
  const content = (
    <>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary group-hover:text-accent truncate">
          {detail.title}
        </p>
        <p className="text-xs text-text-tertiary truncate">{detail.subtitle}</p>
      </div>
      {detail.status && (
        <span className={clsx('text-[10px] px-1.5 py-0.5 rounded', getStatusStyles(detail.status))}>
          {getStatusLabel(detail.status)}
        </span>
      )}
    </>
  );

  const className =
    'flex items-center gap-3 p-2.5 rounded-lg bg-bg-elevated hover:bg-bg-hover transition-colors group';

  return detail.href ? (
    <Link href={detail.href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className.replace('hover:bg-bg-hover', '')}>{content}</div>
  );
}

// ============================================
// Secondary Card Component (Collapsible)
// ============================================

interface SecondaryCardProps {
  item: StoryItem;
  isExpanded: boolean;
  onToggle: () => void;
}

function SecondaryCard({ item, isExpanded, onToggle }: SecondaryCardProps) {
  return (
    <div className="rounded-xl border border-border bg-bg-card overflow-hidden">
      <button
        className="w-full p-4 text-left active:bg-bg-hover transition-colors"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <div className="flex items-start gap-3">
          <CategoryIconRenderer
            category={item.category}
            className="h-4 w-4 text-text-tertiary mt-0.5 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-text-tertiary uppercase tracking-wider">
                {item.category.toLowerCase()}
              </span>
              <UrgencyBadge urgency={item.urgency} />
            </div>
            <h4 className="text-base font-semibold text-text-primary mb-1 leading-tight">
              {item.headline}
            </h4>
            <p className="text-sm text-text-secondary line-clamp-2">{item.summary}</p>
          </div>
          <div className="flex items-center gap-1.5 text-text-tertiary shrink-0">
            {item.details.length > 0 && (
              <span className="text-[10px] bg-bg-elevated px-1.5 py-0.5 rounded">
                {item.details.length}
              </span>
            )}
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && item.details.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-border space-y-2">
              {item.details.map((detail) => (
                <DetailCard key={detail.id} detail={detail} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Tertiary Item Component (Compact one-liner)
// ============================================

interface TertiaryItemProps {
  item: StoryItem;
}

function TertiaryItem({ item }: TertiaryItemProps) {
  const href = item.href || item.details[0]?.href;
  const hasValidHref = href && href !== '#' && href !== '';

  const content = (
    <>
      <div className="h-1.5 w-1.5 rounded-full bg-text-tertiary/50 shrink-0" />
      <span
        className={clsx(
          'text-sm font-medium flex-1',
          hasValidHref
            ? 'text-text-secondary group-active:text-text-primary'
            : 'text-text-secondary'
        )}
      >
        {item.headline}
      </span>
      {hasValidHref && <ChevronRight className="h-3.5 w-3.5 text-text-tertiary shrink-0" />}
    </>
  );

  if (!hasValidHref) {
    return <li className="flex items-center gap-3 py-2.5 px-3 -mx-3">{content}</li>;
  }

  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-lg active:bg-bg-hover transition-colors group"
      >
        {content}
      </Link>
    </li>
  );
}

// ============================================
// Section Header Component
// ============================================

interface SectionHeaderProps {
  title: string;
  count?: number;
}

function SectionHeader({ title, count }: SectionHeaderProps) {
  return (
    <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-2 mb-3 px-6">
      <div className="h-1.5 w-1.5 rounded-full bg-text-tertiary/50" />
      {title}
      {count !== undefined && count > 0 && (
        <span className="text-text-tertiary/70 font-normal">({count})</span>
      )}
    </h3>
  );
}

// ============================================
// Stats Footer Component (2-column for mobile)
// ============================================

interface StatsFooterProps {
  stats: FirmBriefingQuickStats;
}

function StatsFooter({ stats }: StatsFooterProps) {
  const statItems = [
    { icon: Briefcase, value: stats.activeCases, label: 'Dosare', highlight: false },
    {
      icon: AlertTriangle,
      value: stats.urgentTasks,
      label: 'Urgente',
      highlight: stats.urgentTasks > 0,
    },
    { icon: Calendar, value: stats.upcomingDeadlines, label: 'Termene', highlight: false },
    { icon: Users, value: `${stats.teamUtilization}%`, label: 'Echipa', highlight: false },
  ];

  return (
    <footer className="mt-6 pt-4 border-t border-border mx-6">
      <div className="grid grid-cols-2 gap-4">
        {statItems.map((stat) => (
          <div key={stat.label} className="flex items-center gap-3">
            <div
              className={clsx(
                'h-9 w-9 rounded-lg flex items-center justify-center',
                stat.highlight ? 'bg-warning/10' : 'bg-bg-card'
              )}
            >
              <stat.icon
                className={clsx('h-4 w-4', stat.highlight ? 'text-warning' : 'text-text-tertiary')}
              />
            </div>
            <div>
              <p
                className={clsx(
                  'text-base font-semibold',
                  stat.highlight ? 'text-warning' : 'text-text-primary'
                )}
              >
                {stat.value}
              </p>
              <p className="text-[10px] text-text-tertiary">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    </footer>
  );
}

// ============================================
// Empty State Component
// ============================================

interface EmptyStateProps {
  onGenerate: () => void;
  generating: boolean;
}

function EmptyState({ onGenerate, generating }: EmptyStateProps) {
  return (
    <div className="py-12 text-center px-6">
      <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
        <Sparkles className="h-7 w-7 text-accent" />
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1">
        Briefing-ul tau de dimineata
      </h3>
      <p className="text-sm text-text-secondary mb-6 max-w-xs mx-auto">
        Genereaza un briefing inteligent cu cele mai importante aspecte ale zilei.
      </p>
      <Button onClick={onGenerate} loading={generating} fullWidth className="max-w-[200px]">
        {generating ? 'Se genereaza...' : 'Genereaza briefing'}
      </Button>
    </div>
  );
}

// ============================================
// Error State Component
// ============================================

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-12 text-center px-6">
      <AlertCircle className="h-10 w-10 text-error mx-auto mb-3" />
      <h3 className="text-base font-semibold text-text-primary mb-1">Nu s-a putut incarca</h3>
      <p className="text-sm text-text-secondary mb-4">
        A aparut o eroare la incarcarea briefing-ului.
      </p>
      <Button variant="secondary" onClick={onRetry} size="sm">
        Incearca din nou
      </Button>
    </div>
  );
}

// ============================================
// Main DailyBriefing Component
// ============================================

interface DailyBriefingProps {
  className?: string;
}

export function DailyBriefing({ className }: DailyBriefingProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const {
    briefing,
    loading,
    generating,
    error,
    rateLimitInfo,
    clearRateLimitInfo,
    generateBriefing,
    markViewed,
    refetch,
  } = useFirmBriefing();

  // Auto-mark as viewed when briefing is displayed
  useEffect(() => {
    if (briefing && !briefing.isViewed) {
      markViewed(briefing.id);
    }
  }, [briefing, markViewed]);

  const toggleItem = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleGenerate = async () => {
    await generateBriefing(false);
  };

  const handleRegenerate = async () => {
    await generateBriefing(true);
  };

  // Loading state
  if (loading && !briefing) {
    return (
      <div className={className}>
        <BriefingSkeleton />
      </div>
    );
  }

  // Error state
  if (error && !briefing) {
    return (
      <div className={className}>
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  // Empty state (no briefing yet)
  if (!briefing) {
    return (
      <div className={className}>
        <EmptyState onGenerate={handleGenerate} generating={generating} />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Lead Section (Full Prominence) */}
      {briefing.lead.length > 0 && (
        <section className="space-y-3 mb-6 px-6">
          {briefing.lead.map((item) => (
            <LeadCard key={item.id} item={item} />
          ))}
        </section>
      )}

      {/* Secondary Section (Collapsible cards) */}
      {briefing.secondary.items.length > 0 && (
        <section className="mb-6">
          <SectionHeader title={briefing.secondary.title} count={briefing.secondary.items.length} />

          <div className="space-y-3 px-6">
            {briefing.secondary.items.map((item) => (
              <SecondaryCard
                key={item.id}
                item={item}
                isExpanded={expandedItems.has(item.id)}
                onToggle={() => toggleItem(item.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Tertiary Section (Compact list) */}
      {briefing.tertiary.items.length > 0 && (
        <section className="mb-6">
          <SectionHeader title={briefing.tertiary.title} />

          <ul className="space-y-0.5 px-6">
            {briefing.tertiary.items.map((item) => (
              <TertiaryItem key={item.id} item={item} />
            ))}
          </ul>
        </section>
      )}

      {/* Rate limit message */}
      {rateLimitInfo?.limited && (
        <div className="flex items-center justify-between gap-3 text-sm text-accent bg-accent/10 px-4 py-3 rounded-lg mx-6 mb-4 border border-accent/20">
          <div className="flex items-center gap-3">
            <Info className="h-4 w-4 shrink-0" />
            <span>{rateLimitInfo.message}</span>
          </div>
          <button
            onClick={clearRateLimitInfo}
            className="text-accent/70 active:text-accent p-1 active:bg-accent/10 rounded"
            aria-label="Inchide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stale indicator */}
      {briefing.isStale && !rateLimitInfo?.limited && (
        <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 px-4 py-2 rounded-lg mx-6 mb-4">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Briefing-ul poate fi invechit. Regenereaza pentru date actualizate.</span>
        </div>
      )}

      {/* Stats Footer */}
      <StatsFooter stats={briefing.quickStats} />

      {/* Regenerate button at bottom */}
      <div className="px-6 pt-6 pb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRegenerate}
          disabled={generating}
          fullWidth
          leftIcon={<RefreshCw className={clsx('h-4 w-4', generating && 'animate-spin')} />}
        >
          {generating ? 'Se regenereaza...' : 'Regenereaza briefing'}
        </Button>
      </div>
    </div>
  );
}
