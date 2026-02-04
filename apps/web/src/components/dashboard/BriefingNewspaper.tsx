'use client';

/**
 * BriefingNewspaper Component V2
 *
 * Editor-in-Chief model: Typography-driven layout with editorial slots.
 * - Lead: Full-width hero cards with large typography
 * - Secondary: 2-column grid with dynamic section title
 * - Tertiary: Compact list with dynamic section title
 * - Stats footer bar
 *
 * No severity-based colors - visual hierarchy through typography only.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Users,
  Calendar,
  Mail,
  Briefcase,
  User,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { Button, Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui';
import {
  useFirmBriefing,
  type StoryItem,
  type StoryDetail,
  type StoryCategory,
  type StoryUrgency,
  type FirmBriefingQuickStats,
} from '@/hooks/useFirmBriefing';

// ============================================================================
// Utilities
// ============================================================================

function formatDate(date: Date): string {
  const weekday = ['Duminica', 'Luni', 'Marti', 'Miercuri', 'Joi', 'Vineri', 'Sambata'];
  const months = [
    'ianuarie',
    'februarie',
    'martie',
    'aprilie',
    'mai',
    'iunie',
    'iulie',
    'august',
    'septembrie',
    'octombrie',
    'noiembrie',
    'decembrie',
  ];
  return `${weekday[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatGeneratedTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

function getStatusStyles(status?: string) {
  switch (status) {
    case 'OVERDUE':
      return 'bg-red-500/20 text-red-400';
    case 'AT_RISK':
      return 'bg-amber-500/20 text-amber-400';
    case 'ON_TRACK':
      return 'bg-green-500/20 text-green-400';
    default:
      return 'bg-linear-bg-tertiary text-linear-text-muted';
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

// ============================================================================
// Category Icon Renderer
// ============================================================================

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
      return <Mail className={className} aria-hidden="true" />;
    case 'CASE':
    default:
      return <Briefcase className={className} aria-hidden="true" />;
  }
}

// ============================================================================
// Urgency Badge (Subtle, Optional)
// ============================================================================

interface UrgencyBadgeProps {
  urgency?: StoryUrgency;
}

function UrgencyBadge({ urgency }: UrgencyBadgeProps) {
  if (!urgency || urgency === 'LOW') return null;

  if (urgency === 'HIGH') {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
        Urgent
      </span>
    );
  }

  if (urgency === 'MEDIUM') {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
        Atentie
      </span>
    );
  }

  return null;
}

// ============================================================================
// Skeleton Component
// ============================================================================

function BriefingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Masthead skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-linear-bg-tertiary" />
        <div>
          <div className="h-5 w-32 bg-linear-bg-tertiary rounded mb-1" />
          <div className="h-3 w-48 bg-linear-bg-tertiary rounded" />
        </div>
      </div>

      {/* Lead skeleton */}
      <div className="h-40 rounded-xl bg-linear-bg-tertiary" />

      {/* Secondary skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="h-28 rounded-lg bg-linear-bg-tertiary" />
        <div className="h-28 rounded-lg bg-linear-bg-tertiary" />
      </div>
    </div>
  );
}

// ============================================================================
// Masthead Component
// ============================================================================

interface MastheadProps {
  generatedAt?: string;
  onRegenerate: () => void;
  generating: boolean;
}

function Masthead({ generatedAt, onRegenerate, generating }: MastheadProps) {
  const dateStr = formatDate(new Date());
  const timeStr = generatedAt ? `Generat la ${formatGeneratedTime(generatedAt)}` : '';

  return (
    <header className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-linear-text-primary tracking-tight">
            Briefing Zilnic
          </h1>
          <p className="text-xs text-linear-text-muted">
            {dateStr}
            {timeStr && ` · ${timeStr}`}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRegenerate}
        disabled={generating}
        className="text-linear-text-muted hover:text-linear-accent"
      >
        <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
      </Button>
    </header>
  );
}

// ============================================================================
// Lead Card Component (Full Prominence)
// ============================================================================

interface LeadCardProps {
  item: StoryItem;
}

function LeadCard({ item }: LeadCardProps) {
  return (
    <article className="relative p-6 rounded-xl bg-linear-bg-secondary border border-linear-border-subtle">
      {/* Category + Optional urgency badge */}
      <div className="flex items-center gap-2 mb-4">
        <CategoryIconRenderer category={item.category} className="h-4 w-4 text-linear-text-muted" />
        <span className="text-[10px] text-linear-text-muted uppercase tracking-wider font-medium">
          {item.category.toLowerCase()}
        </span>
        <div className="ml-auto">
          <UrgencyBadge urgency={item.urgency} />
        </div>
      </div>

      {/* Headline - Large Typography */}
      <h2 className="text-2xl font-bold text-linear-text-primary mb-3 leading-tight">
        {item.headline}
      </h2>

      {/* Summary */}
      <p className="text-base text-linear-text-secondary leading-relaxed mb-5">{item.summary}</p>

      {/* Inline details grid */}
      {item.details.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {item.details.map((detail) => (
            <DetailCard key={detail.id} detail={detail} />
          ))}
        </div>
      )}
    </article>
  );
}

// ============================================================================
// Detail Card Component (Shared)
// ============================================================================

interface DetailCardProps {
  detail: StoryDetail;
  compact?: boolean;
}

function DetailCard({ detail, compact = false }: DetailCardProps) {
  const content = (
    <>
      <div className="flex-1 min-w-0">
        <p
          className={`font-medium text-linear-text-primary group-hover:text-linear-accent truncate ${compact ? 'text-xs' : 'text-sm'}`}
        >
          {detail.title}
        </p>
        <p className="text-[10px] text-linear-text-muted truncate">{detail.subtitle}</p>
      </div>
      {detail.status && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusStyles(detail.status)}`}>
          {getStatusLabel(detail.status)}
        </span>
      )}
    </>
  );

  const className = `flex items-center gap-3 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group`;

  return detail.href ? (
    <Link href={detail.href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className.replace('hover:bg-white/10', '')}>{content}</div>
  );
}

// ============================================================================
// Secondary Card Component (2-column grid)
// ============================================================================

interface SecondaryCardProps {
  item: StoryItem;
  isExpanded: boolean;
  onToggle: () => void;
}

function SecondaryCard({ item, isExpanded, onToggle }: SecondaryCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    } else if (e.key === 'Escape' && isExpanded) {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            className="w-full p-4 text-left hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-inset"
            aria-expanded={isExpanded}
            onKeyDown={handleKeyDown}
          >
            <div className="flex items-start gap-3">
              <CategoryIconRenderer
                category={item.category}
                className="h-4 w-4 text-linear-text-muted mt-0.5 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-linear-text-muted uppercase tracking-wider">
                    {item.category.toLowerCase()}
                  </span>
                  <UrgencyBadge urgency={item.urgency} />
                </div>
                <h4 className="text-lg font-semibold text-linear-text-primary mb-1 leading-tight">
                  {item.headline}
                </h4>
                <p className="text-sm text-linear-text-secondary line-clamp-2">{item.summary}</p>
              </div>
              <div className="flex items-center gap-1.5 text-linear-text-muted shrink-0">
                {item.details.length > 0 && (
                  <span className="text-[10px] bg-linear-bg-secondary px-1.5 py-0.5 rounded">
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
        </CollapsibleTrigger>

        <CollapsibleContent>
          {item.details.length > 0 && (
            <div className="px-4 pb-4 pt-2 border-t border-linear-border-subtle space-y-1.5">
              {item.details.map((detail) => (
                <DetailCard key={detail.id} detail={detail} compact />
              ))}
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ============================================================================
// Tertiary Item Component (Compact one-liner)
// ============================================================================

interface TertiaryItemProps {
  item: StoryItem;
}

function TertiaryItem({ item }: TertiaryItemProps) {
  const href = item.href || item.details[0]?.href;
  const hasValidHref = href && href !== '#' && href !== '';

  const content = (
    <>
      <div className="h-1.5 w-1.5 rounded-full bg-linear-text-muted/50 shrink-0" />
      <span
        className={`text-sm font-medium flex-1 ${hasValidHref ? 'text-linear-text-secondary group-hover:text-linear-text-primary transition-colors' : 'text-linear-text-secondary'}`}
      >
        {item.headline}
      </span>
      {hasValidHref && (
        <ChevronRight className="h-3.5 w-3.5 text-linear-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </>
  );

  if (!hasValidHref) {
    return <li className="flex items-center gap-3 py-2.5 px-3 -mx-3">{content}</li>;
  }

  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-lg hover:bg-linear-bg-tertiary/50 transition-colors group"
      >
        {content}
      </Link>
    </li>
  );
}

// ============================================================================
// Section Header Component
// ============================================================================

interface SectionHeaderProps {
  title: string;
  count?: number;
}

function SectionHeader({ title, count }: SectionHeaderProps) {
  return (
    <h3 className="text-xs font-semibold text-linear-text-muted uppercase tracking-wider flex items-center gap-2 mb-3">
      <div className="h-1.5 w-1.5 rounded-full bg-linear-text-muted/50" />
      {title}
      {count !== undefined && count > 0 && (
        <span className="text-linear-text-tertiary font-normal">({count})</span>
      )}
    </h3>
  );
}

// ============================================================================
// Stats Footer Component
// ============================================================================

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
    <footer className="mt-6 pt-4 border-t border-linear-border-subtle">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statItems.map((stat) => (
          <div key={stat.label} className="flex items-center gap-3">
            <div
              className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                stat.highlight ? 'bg-amber-500/10' : 'bg-linear-bg-tertiary'
              }`}
            >
              <stat.icon
                className={`h-4 w-4 ${
                  stat.highlight ? 'text-amber-400' : 'text-linear-text-muted'
                }`}
              />
            </div>
            <div>
              <p
                className={`text-sm font-semibold ${
                  stat.highlight ? 'text-amber-400' : 'text-linear-text-primary'
                }`}
              >
                {stat.value}
              </p>
              <p className="text-[10px] text-linear-text-muted">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    </footer>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

interface EmptyStateProps {
  onGenerate: () => void;
  generating: boolean;
}

function EmptyState({ onGenerate, generating }: EmptyStateProps) {
  return (
    <div className="py-12 text-center">
      <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
        <Sparkles className="h-7 w-7 text-blue-400" />
      </div>
      <h3 className="text-base font-medium text-linear-text-primary mb-1">
        Briefing-ul tau de dimineata
      </h3>
      <p className="text-sm text-linear-text-muted mb-6 max-w-xs mx-auto">
        Genereaza un briefing inteligent cu cele mai importante aspecte ale zilei.
      </p>
      <Button onClick={onGenerate} disabled={generating}>
        {generating ? (
          <>
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Se genereaza...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Genereaza briefing
          </>
        )}
      </Button>
    </div>
  );
}

// ============================================================================
// Error State Component
// ============================================================================

function ErrorState() {
  return (
    <div className="py-6 text-center">
      <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
      <p className="text-sm text-linear-text-muted">Nu s-a putut incarca briefing-ul.</p>
    </div>
  );
}

// ============================================================================
// Main BriefingNewspaper Component
// ============================================================================

interface BriefingNewspaperProps {
  className?: string;
}

export function BriefingNewspaper({ className }: BriefingNewspaperProps) {
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
  } = useFirmBriefing();

  // Auto-mark as viewed when briefing is displayed
  useEffect(() => {
    if (briefing && !briefing.isViewed) {
      markViewed(briefing.id);
    }
  }, [briefing?.id, briefing?.isViewed, markViewed]);

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
  if (loading) {
    return (
      <div className={`max-w-4xl mx-auto ${className || ''}`}>
        <Masthead onRegenerate={handleRegenerate} generating={generating} />
        <BriefingSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`max-w-4xl mx-auto ${className || ''}`}>
        <Masthead onRegenerate={handleRegenerate} generating={generating} />
        <ErrorState />
      </div>
    );
  }

  // Empty state (no briefing yet)
  if (!briefing) {
    return (
      <div className={`max-w-4xl mx-auto ${className || ''}`}>
        <Masthead onRegenerate={handleRegenerate} generating={generating} />
        <EmptyState onGenerate={handleGenerate} generating={generating} />
      </div>
    );
  }

  return (
    <div className={`max-w-4xl mx-auto ${className || ''}`}>
      {/* Masthead */}
      <Masthead
        generatedAt={briefing.generatedAt}
        onRegenerate={handleRegenerate}
        generating={generating}
      />

      {/* Lead Section (Full Prominence) */}
      {briefing.lead.length > 0 && (
        <section className="space-y-4 mb-8">
          {briefing.lead.map((item) => (
            <LeadCard key={item.id} item={item} />
          ))}
        </section>
      )}

      {/* Secondary Section (2-column grid with dynamic title) */}
      {briefing.secondary.items.length > 0 && (
        <section className="mb-8">
          <SectionHeader title={briefing.secondary.title} count={briefing.secondary.items.length} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

      {/* Tertiary Section (Compact list with dynamic title) */}
      {briefing.tertiary.items.length > 0 && (
        <section className="mb-8">
          <SectionHeader title={briefing.tertiary.title} />

          <ul className="space-y-0.5">
            {briefing.tertiary.items.map((item) => (
              <TertiaryItem key={item.id} item={item} />
            ))}
          </ul>
        </section>
      )}

      {/* Rate limit message */}
      {rateLimitInfo?.limited && (
        <div className="flex items-center justify-between gap-3 text-sm text-blue-400 bg-blue-500/10 px-4 py-3 rounded-lg mb-6 border border-blue-500/20">
          <div className="flex items-center gap-3">
            <Info className="h-4 w-4 shrink-0" />
            <span>{rateLimitInfo.message}</span>
          </div>
          <button
            onClick={clearRateLimitInfo}
            className="text-blue-400/70 hover:text-blue-400 transition-colors p-1 hover:bg-blue-500/10 rounded"
            aria-label="Inchide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stale indicator */}
      {briefing.isStale && !rateLimitInfo?.limited && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg mb-6">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Briefing-ul poate fi invechit. Regenereaza pentru date actualizate.</span>
        </div>
      )}

      {/* Stats Footer */}
      <StatsFooter stats={briefing.quickStats} />
    </div>
  );
}
