/**
 * CaseActivityFeed Component
 * Story 4.6: Task Collaboration and Updates (AC: 2)
 *
 * Displays real-time activity feed for a case with filtering options
 */

'use client';

import React, { useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  useCaseActivityFeed,
  getActivityTypeLabel,
  getActivityTypeIcon,
  getActivityTypeColor,
  type CaseActivityEntry,
  type CaseActivityType,
} from '@/hooks/useCaseActivityFeed';

interface CaseActivityFeedProps {
  caseId: string;
  compact?: boolean;
}

const ACTIVITY_FILTER_OPTIONS: Array<{ value: CaseActivityType | 'all'; label: string }> = [
  { value: 'all', label: 'Toate activitățile' },
  { value: 'TaskCreated', label: 'Sarcini noi' },
  { value: 'TaskCompleted', label: 'Sarcini finalizate' },
  { value: 'TaskCommented', label: 'Comentarii' },
  { value: 'DocumentUploaded', label: 'Documente' },
  { value: 'DeadlineApproaching', label: 'Termene' },
];

export function CaseActivityFeed({ caseId, compact = false }: CaseActivityFeedProps) {
  const [activityFilter, setActivityFilter] = useState<CaseActivityType | 'all'>('all');
  const [showAll, setShowAll] = useState(false);

  const options = {
    limit: showAll ? 50 : compact ? 5 : 10,
    activityTypes: activityFilter === 'all' ? undefined : [activityFilter],
  };

  const { data, loading, error, fetchMore } = useCaseActivityFeed(caseId, options);
  const feed = data?.caseActivityFeed;

  const loadMore = () => {
    if (feed?.nextCursor) {
      fetchMore({
        variables: {
          caseId,
          options: { ...options, cursor: feed.nextCursor },
        },
      });
    }
  };

  if (loading && !feed) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-2/3" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 text-sm">Eroare la încărcarea activității</div>;
  }

  const entries = feed?.entries || [];

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      {!compact && (
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Activitate Dosar</h3>
          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value as CaseActivityType | 'all')}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {ACTIVITY_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Activity list */}
      {entries.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">Nicio activitate de afișat</p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <ActivityEntryItem key={entry.id} entry={entry} compact={compact} />
          ))}
        </div>
      )}

      {/* Load more / Show all */}
      {(feed?.hasMore || (!showAll && entries.length >= (compact ? 5 : 10))) && (
        <div className="text-center">
          {compact ? (
            <button
              onClick={() => setShowAll(true)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Vezi toate activitățile
            </button>
          ) : (
            feed?.hasMore && (
              <button onClick={loadMore} className="text-sm text-blue-600 hover:text-blue-800">
                Încarcă mai multe
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

interface ActivityEntryItemProps {
  entry: CaseActivityEntry;
  compact?: boolean;
}

function ActivityEntryItem({ entry, compact }: ActivityEntryItemProps) {
  const icon = getActivityTypeIcon(entry.activityType);
  const label = getActivityTypeLabel(entry.activityType);
  const colorClass = getActivityTypeColor(entry.activityType);
  const actorName = `${entry.actor.firstName} ${entry.actor.lastName}`;

  return (
    <div className="flex gap-3">
      {/* Icon */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${colorClass}`}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm">
              <span className="font-medium text-gray-900">{actorName}</span>
              <span className="text-gray-600 ml-1">- {label}</span>
            </p>
            <p className="text-sm text-gray-700 font-medium truncate">{entry.title}</p>
            {!compact && entry.summary && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{entry.summary}</p>
            )}
          </div>

          <span
            className="text-xs text-gray-400 flex-shrink-0"
            title={format(new Date(entry.createdAt), 'dd MMM yyyy HH:mm', { locale: ro })}
          >
            {formatDistanceToNow(new Date(entry.createdAt), {
              addSuffix: true,
              locale: ro,
            })}
          </span>
        </div>

        {/* Link to entity */}
        {entry.entityType === 'Task' && (
          <a
            href={`?task=${entry.entityId}`}
            className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block"
          >
            Vezi sarcina
          </a>
        )}
        {entry.entityType === 'Document' && (
          <a
            href={`/documents/${entry.entityId}`}
            className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block"
          >
            Vezi documentul
          </a>
        )}
      </div>
    </div>
  );
}

export default CaseActivityFeed;
