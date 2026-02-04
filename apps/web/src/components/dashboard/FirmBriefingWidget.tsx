'use client';

/**
 * FirmBriefingWidget V2
 *
 * Compact dashboard widget version of the firm briefing.
 * Uses V2 Editor-in-Chief model with editorial slots.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Info,
  Users,
  Calendar,
  Mail,
  Briefcase,
  User,
  Clock,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui';
import {
  useFirmBriefing,
  type StoryItem,
  type StoryCategory,
  type StoryUrgency,
} from '@/hooks/useFirmBriefing';

// ============================================================================
// Types
// ============================================================================

interface FirmBriefingWidgetProps {
  className?: string;
}

// ============================================================================
// Utilities
// ============================================================================

function getCategoryIcon(category: StoryCategory) {
  switch (category) {
    case 'CLIENT':
      return User;
    case 'TEAM':
      return Users;
    case 'DEADLINE':
      return Calendar;
    case 'EMAIL':
      return Mail;
    case 'CASE':
    default:
      return Briefcase;
  }
}

function getStatusStyles(status?: string) {
  switch (status) {
    case 'OVERDUE':
      return 'text-red-400 bg-red-500/10';
    case 'AT_RISK':
      return 'text-amber-400 bg-amber-500/10';
    case 'ON_TRACK':
      return 'text-green-400 bg-green-500/10';
    default:
      return 'text-linear-text-muted bg-linear-bg-tertiary';
  }
}

function formatGeneratedAt(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

// ============================================================================
// Skeleton Component
// ============================================================================

function BriefingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="animate-pulse">
        <div className="h-5 w-48 bg-linear-bg-tertiary rounded mb-2" />
        <div className="h-4 w-full bg-linear-bg-tertiary rounded mb-1" />
        <div className="h-4 w-3/4 bg-linear-bg-tertiary rounded" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-linear-bg-tertiary rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Quick Stats Component
// ============================================================================

interface QuickStatsProps {
  stats: {
    activeCases: number;
    urgentTasks: number;
    teamUtilization: number;
    unreadEmails: number;
    overdueItems: number;
    upcomingDeadlines: number;
  };
}

function QuickStats({ stats }: QuickStatsProps) {
  const statItems = [
    { label: 'Dosare', value: stats.activeCases, icon: Briefcase },
    {
      label: 'Urgente',
      value: stats.urgentTasks,
      icon: AlertTriangle,
      highlight: stats.urgentTasks > 0,
    },
    { label: 'Termene', value: stats.upcomingDeadlines, icon: Calendar },
    { label: 'Echipa', value: `${stats.teamUtilization}%`, icon: Users },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 pt-3 border-t border-linear-border-subtle">
      {statItems.map((stat) => (
        <div key={stat.label} className="text-center">
          <div className="flex items-center justify-center gap-1">
            <stat.icon
              className={`h-3 w-3 ${stat.highlight ? 'text-amber-400' : 'text-linear-text-muted'}`}
            />
            <span
              className={`text-sm font-semibold ${stat.highlight ? 'text-amber-400' : 'text-linear-text-primary'}`}
            >
              {stat.value}
            </span>
          </div>
          <span className="text-[10px] text-linear-text-muted">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Urgency Badge
// ============================================================================

function UrgencyBadge({ urgency }: { urgency?: StoryUrgency }) {
  if (!urgency || urgency === 'LOW') return null;

  if (urgency === 'HIGH') {
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
        Urgent
      </span>
    );
  }

  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
      Atentie
    </span>
  );
}

// ============================================================================
// Story Item Row Component (V2)
// ============================================================================

interface StoryItemRowProps {
  item: StoryItem;
  isExpanded: boolean;
  onToggle: () => void;
}

function StoryItemRow({ item, isExpanded, onToggle }: StoryItemRowProps) {
  const CategoryIcon = getCategoryIcon(item.category);

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
            className="w-full p-3 flex items-start gap-3 hover:bg-white/5 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-inset"
            aria-expanded={isExpanded}
            onKeyDown={handleKeyDown}
          >
            <CategoryIcon
              className="h-4 w-4 text-linear-text-muted mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs text-linear-text-muted capitalize">
                  {item.category.toLowerCase()}
                </span>
                <UrgencyBadge urgency={item.urgency} />
              </div>
              <p className="text-sm font-medium text-linear-text-primary leading-tight">
                {item.headline}
              </p>
              <p className="text-xs text-linear-text-secondary mt-0.5 line-clamp-2">
                {item.summary}
              </p>
            </div>
            <div className="flex items-center gap-1 text-linear-text-muted" aria-hidden="true">
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
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {item.details.length > 0 && (
            <div className="px-3 pb-3 space-y-1.5 border-t border-linear-border-subtle">
              {item.details.map((detail) => {
                const content = (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-linear-text-primary group-hover:text-linear-accent transition-colors truncate">
                        {detail.title}
                      </p>
                      <p className="text-[10px] text-linear-text-muted truncate">
                        {detail.subtitle}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {detail.dueDateLabel && (
                        <span className="text-[10px] text-linear-text-muted flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {detail.dueDateLabel}
                        </span>
                      )}
                      {detail.status && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusStyles(detail.status)}`}
                        >
                          {detail.status === 'ON_TRACK'
                            ? 'OK'
                            : detail.status === 'AT_RISK'
                              ? 'Risc'
                              : 'Dep.'}
                        </span>
                      )}
                    </div>
                  </>
                );

                return detail.href ? (
                  <Link
                    key={detail.id}
                    href={detail.href}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-white/5 transition-colors group"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={detail.id} className="flex items-center justify-between p-2 rounded-md">
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState({ onGenerate, generating }: { onGenerate: () => void; generating: boolean }) {
  return (
    <div className="py-8 text-center">
      <div className="h-12 w-12 rounded-xl bg-linear-accent/10 flex items-center justify-center mx-auto mb-3">
        <Sparkles className="h-6 w-6 text-linear-accent" />
      </div>
      <h3 className="text-sm font-medium text-linear-text-primary mb-1">
        Briefing-ul tau de dimineata
      </h3>
      <p className="text-xs text-linear-text-muted mb-4 max-w-[200px] mx-auto">
        Genereaza un briefing inteligent cu cele mai importante aspecte ale firmei.
      </p>
      <button
        onClick={onGenerate}
        disabled={generating}
        className="inline-flex items-center gap-2 px-4 py-2 bg-linear-accent text-white text-sm font-medium rounded-lg hover:bg-linear-accent/90 transition-colors disabled:opacity-50"
      >
        {generating ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            Se genereaza...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Genereaza briefing
          </>
        )}
      </button>
    </div>
  );
}

// ============================================================================
// Not Eligible State Component
// ============================================================================

function NotEligibleState() {
  return (
    <div className="py-6 text-center">
      <div className="h-10 w-10 rounded-lg bg-linear-bg-tertiary flex items-center justify-center mx-auto mb-2">
        <Info className="h-5 w-5 text-linear-text-muted" />
      </div>
      <p className="text-sm text-linear-text-muted">
        Briefing-ul este disponibil doar pentru parteneri.
      </p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

const MAX_VISIBLE_ITEMS = 5;

export function FirmBriefingWidget({ className }: FirmBriefingWidgetProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showAllItems, setShowAllItems] = useState(false);
  const {
    briefing,
    eligible,
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

  // Combine all items from V2 structure for widget display
  const allItems: StoryItem[] = briefing
    ? [...briefing.lead, ...briefing.secondary.items, ...briefing.tertiary.items]
    : [];

  // Visible items (limited unless showAllItems is true)
  const visibleItems =
    allItems.length > MAX_VISIBLE_ITEMS && !showAllItems
      ? allItems.slice(0, MAX_VISIBLE_ITEMS)
      : allItems;

  const hiddenCount = allItems.length - MAX_VISIBLE_ITEMS;

  // Generate summary from lead headline
  const summary =
    briefing && briefing.lead.length > 0
      ? `${briefing.lead[0].headline}. ${briefing.lead[0].summary}`
      : null;

  return (
    <Card className={`bg-linear-bg-secondary border-linear-border-subtle ${className || ''}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-linear-accent/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-linear-accent" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight">
              Briefing Dimineata
            </CardTitle>
            {briefing && (
              <span className="text-[10px] text-linear-text-muted">
                {formatGeneratedAt(briefing.generatedAt)}
              </span>
            )}
          </div>
        </div>
        {briefing && (
          <button
            onClick={handleRegenerate}
            disabled={generating}
            className="p-1.5 rounded-md text-linear-text-muted hover:text-linear-accent hover:bg-linear-bg-tertiary transition-colors disabled:opacity-50"
            title="Regenereaza briefing"
          >
            <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
          </button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <BriefingSkeleton />
        ) : error ? (
          <div className="py-6 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-linear-text-muted">Nu s-a putut incarca briefing-ul.</p>
          </div>
        ) : !eligible ? (
          <NotEligibleState />
        ) : !briefing ? (
          <EmptyState onGenerate={handleGenerate} generating={generating} />
        ) : (
          <div className="space-y-4">
            {/* Summary from lead */}
            {summary && (
              <div className="space-y-1">
                <p className="text-sm text-linear-text-secondary leading-relaxed">{summary}</p>
              </div>
            )}

            {/* Briefing Items */}
            {visibleItems.length > 0 && (
              <div className="space-y-2">
                {visibleItems.map((item) => (
                  <StoryItemRow
                    key={item.id}
                    item={item}
                    isExpanded={expandedItems.has(item.id)}
                    onToggle={() => toggleItem(item.id)}
                  />
                ))}

                {/* Show more/less button */}
                {allItems.length > MAX_VISIBLE_ITEMS && (
                  <button
                    onClick={() => setShowAllItems(!showAllItems)}
                    className="w-full py-2 text-xs text-linear-text-muted hover:text-linear-accent transition-colors flex items-center justify-center gap-1"
                  >
                    {showAllItems ? (
                      <>
                        <ChevronDown className="h-3 w-3 rotate-180" />
                        Arata mai putine
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        Arata mai multe ({hiddenCount})
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Quick Stats */}
            <QuickStats stats={briefing.quickStats} />

            {/* Rate limit message */}
            {rateLimitInfo?.limited && (
              <div className="flex items-center justify-between gap-2 text-[10px] text-blue-400 bg-blue-500/10 px-2 py-1.5 rounded">
                <div className="flex items-center gap-2">
                  <Info className="h-3 w-3 shrink-0" />
                  <span>{rateLimitInfo.message}</span>
                </div>
                <button
                  onClick={clearRateLimitInfo}
                  className="text-blue-400/70 hover:text-blue-400 transition-colors"
                  aria-label="Inchide"
                >
                  ×
                </button>
              </div>
            )}

            {/* Stale indicator */}
            {briefing.isStale && !rateLimitInfo?.limited && (
              <div className="flex items-center gap-2 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                <AlertCircle className="h-3 w-3" />
                <span>Briefing-ul poate fi invechit. Regenereaza pentru date actualizate.</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
