'use client';

/**
 * Review History Timeline
 * Story 3.6: Document Review and Approval Workflow
 *
 * Timeline component showing the history of review actions
 */

import * as React from 'react';
import {
  Send,
  UserPlus,
  MessageSquare,
  CheckCircle,
  XCircle,
  RotateCcw,
  Check,
  History,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface ReviewHistoryEntry {
  id: string;
  action: string;
  actor: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  previousStatus?: string;
  newStatus?: string;
  feedback?: string;
  timestamp: string;
}

interface ReviewHistoryTimelineProps {
  history: ReviewHistoryEntry[];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
}

const actionConfig: Record<
  string,
  {
    icon: typeof Send;
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  SUBMITTED: {
    icon: Send,
    label: 'Submitted for review',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  ASSIGNED: {
    icon: UserPlus,
    label: 'Reviewer assigned',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  COMMENT_ADDED: {
    icon: MessageSquare,
    label: 'Comment added',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  COMMENT_RESOLVED: {
    icon: Check,
    label: 'Comment resolved',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  APPROVED: {
    icon: CheckCircle,
    label: 'Document approved',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  REJECTED: {
    icon: XCircle,
    label: 'Document rejected',
    color: 'text-destructive',
    bgColor: 'bg-red-100',
  },
  REVISION_REQUESTED: {
    icon: RotateCcw,
    label: 'Revision requested',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
  },
  RESUBMITTED: {
    icon: Send,
    label: 'Resubmitted for review',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
};

export function ReviewHistoryTimeline({ history }: ReviewHistoryTimelineProps) {
  if (history.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Review History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No history yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Review History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-4">
            {history.map((entry, index) => {
              const config = actionConfig[entry.action] || {
                icon: History,
                label: entry.action,
                color: 'text-gray-600',
                bgColor: 'bg-gray-100',
              };
              const Icon = config.icon;
              const isFirst = index === 0;
              const isLast = index === history.length - 1;

              return (
                <div key={entry.id} className="relative pl-10">
                  {/* Timeline dot/icon */}
                  <div className={`absolute left-0 p-1.5 rounded-full ${config.bgColor}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>

                  <div className={`pb-4 ${isLast ? '' : 'border-b'}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {getInitials(entry.actor.firstName, entry.actor.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">
                        {entry.actor.firstName} {entry.actor.lastName}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {config.label.toLowerCase()}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(entry.timestamp)}
                    </p>

                    {entry.feedback && (
                      <div className="mt-2 p-2 bg-muted rounded text-sm">{entry.feedback}</div>
                    )}

                    {entry.previousStatus && entry.newStatus && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Status: {entry.previousStatus} → {entry.newStatus}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
