'use client';

import { useMemo } from 'react';
import { Info, FileText, Mail, CheckSquare, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface RawActivity {
  id: string;
  type: 'document' | 'email' | 'task' | 'status';
  title: string;
  occurredAt: string;
  metadata?: {
    documentId?: string;
    emailId?: string;
    taskId?: string;
  };
}

export interface RawActivityFallbackProps {
  activities: RawActivity[];
  loading?: boolean;
  className?: string;
  /** Callback when a document is clicked for preview */
  onDocumentClick?: (documentId: string, fileType: string, fileName: string) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getActivityIcon(type: RawActivity['type']) {
  switch (type) {
    case 'document':
      return FileText;
    case 'email':
      return Mail;
    case 'task':
      return CheckSquare;
    case 'status':
      return RefreshCw;
    default:
      return FileText;
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDateKey(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

// ============================================================================
// Sub-components
// ============================================================================

function InfoBanner() {
  return (
    <div className="bg-linear-bg-elevated border-l-4 border-linear-accent p-4 flex items-start gap-3">
      <Info className="h-5 w-5 text-linear-accent flex-shrink-0 mt-0.5" />
      <p className="text-linear-sm text-linear-text-secondary">
        Acest dosar nu are inca un istoric structurat. Activitatile sunt afisate cronologic.
      </p>
    </div>
  );
}

interface DateSeparatorProps {
  date: string;
}

function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="py-3 px-4 bg-linear-bg-secondary">
      <span className="text-linear-xs font-medium text-linear-text-tertiary uppercase tracking-wide">
        {date}
      </span>
    </div>
  );
}

interface ActivityItemProps {
  activity: RawActivity;
  isLast: boolean;
  onDocumentClick?: (documentId: string, fileType: string, fileName: string) => void;
}

function ActivityItem({ activity, isLast, onDocumentClick }: ActivityItemProps) {
  const Icon = getActivityIcon(activity.type);
  const time = formatTime(activity.occurredAt);

  const isClickable =
    activity.type === 'document' && activity.metadata?.documentId && onDocumentClick;

  const handleClick = () => {
    if (isClickable && activity.metadata?.documentId) {
      // Extract file extension from title (filename) for fileType
      const fileName = activity.title;
      const ext = fileName.split('.').pop()?.toLowerCase() || 'other';
      onDocumentClick(activity.metadata.documentId, ext, fileName);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 py-2 px-4',
        !isLast && 'border-b border-linear-border-subtle',
        isClickable && 'cursor-pointer hover:bg-linear-bg-hover transition-colors'
      )}
      onClick={handleClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && handleClick() : undefined}
    >
      <div className="flex-shrink-0">
        <Icon
          className={cn(
            'h-4 w-4',
            isClickable ? 'text-linear-accent' : 'text-linear-text-tertiary'
          )}
        />
      </div>
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            'text-linear-sm truncate block',
            isClickable ? 'text-linear-accent hover:underline' : 'text-linear-text-primary'
          )}
        >
          {activity.title}
        </span>
      </div>
      <div className="flex-shrink-0">
        <span className="text-linear-xs text-linear-text-tertiary">{time}</span>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <div className="h-4 w-4 rounded bg-linear-bg-tertiary animate-pulse" />
          <div className="flex-1 h-4 rounded bg-linear-bg-tertiary animate-pulse" />
          <div className="h-4 w-12 rounded bg-linear-bg-tertiary animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-12 h-12 rounded-full bg-linear-bg-tertiary flex items-center justify-center mb-3">
        <FileText className="h-6 w-6 text-linear-text-tertiary" />
      </div>
      <p className="text-linear-sm text-linear-text-secondary text-center">
        Nu exista activitati inregistrate pentru acest dosar.
      </p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RawActivityFallback({
  activities,
  loading = false,
  className,
  onDocumentClick,
}: RawActivityFallbackProps) {
  // Group activities by date
  const groupedActivities = useMemo(() => {
    if (!activities.length) return [];

    // Sort activities by date descending (newest first)
    const sorted = [...activities].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    );

    // Group by date
    const groups: { date: string; dateLabel: string; items: RawActivity[] }[] = [];
    let currentDateKey = '';

    for (const activity of sorted) {
      const dateKey = getDateKey(activity.occurredAt);

      if (dateKey !== currentDateKey) {
        currentDateKey = dateKey;
        groups.push({
          date: dateKey,
          dateLabel: formatDate(activity.occurredAt),
          items: [],
        });
      }

      groups[groups.length - 1].items.push(activity);
    }

    return groups;
  }, [activities]);

  if (loading) {
    return (
      <div className={cn('flex flex-col', className)}>
        <InfoBanner />
        <LoadingSkeleton />
      </div>
    );
  }

  if (!activities.length) {
    return (
      <div className={cn('flex flex-col', className)}>
        <InfoBanner />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <InfoBanner />

      <div className="flex-1">
        {groupedActivities.map((group) => (
          <div key={group.date}>
            <DateSeparator date={group.dateLabel} />
            <div>
              {group.items.map((activity, index) => (
                <ActivityItem
                  key={activity.id}
                  activity={activity}
                  isLast={index === group.items.length - 1}
                  onDocumentClick={onDocumentClick}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
