'use client';

import { Clock, Mail, AlertCircle, CheckCircle2, XCircle, Bell } from 'lucide-react';
import { Badge, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { DocumentRequest, DocumentRequestStatus } from '@/types/mapa';
import { requestStatusInfo } from '@/types/mapa';

interface RequestStatusBadgeProps {
  request: DocumentRequest;
  className?: string;
}

// Badge variant mapping based on request status
const statusBadgeVariants: Record<
  DocumentRequestStatus,
  'default' | 'info' | 'warning' | 'success' | 'error'
> = {
  pending: 'default',
  sent: 'info',
  reminded: 'warning',
  received: 'success',
  expired: 'error',
  cancelled: 'default',
};

// Icon mapping for each status
const statusIcons: Record<DocumentRequestStatus, React.ReactNode> = {
  pending: <Clock className="w-3 h-3" />,
  sent: <Mail className="w-3 h-3" />,
  reminded: <Bell className="w-3 h-3" />,
  received: <CheckCircle2 className="w-3 h-3" />,
  expired: <AlertCircle className="w-3 h-3" />,
  cancelled: <XCircle className="w-3 h-3" />,
};

// Calculate days until or past due date
function getDaysUntilDue(dueDate: string): { days: number; isPast: boolean } {
  const due = new Date(dueDate);
  const now = new Date();

  // Reset time to compare dates only
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    days: Math.abs(diffDays),
    isPast: diffDays < 0,
  };
}

// Format date for display
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function RequestStatusBadge({ request, className }: RequestStatusBadgeProps) {
  const statusInfo = requestStatusInfo[request.status];
  const variant = statusBadgeVariants[request.status];
  const icon = statusIcons[request.status];
  const { days, isPast } = getDaysUntilDue(request.dueDate);

  // Build due date text
  const getDueDateText = (): string => {
    if (request.status === 'received' || request.status === 'cancelled') {
      return '';
    }

    if (days === 0) {
      return 'Scadent astazi';
    }

    if (isPast) {
      return `${days} ${days === 1 ? 'zi' : 'zile'} intarziere`;
    }

    return `${days} ${days === 1 ? 'zi' : 'zile'} ramase`;
  };

  const dueDateText = getDueDateText();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex', className)}>
            <Badge variant={variant} icon={icon} dot>
              {statusInfo.label}
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2 py-1">
            {/* Recipient info */}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-linear-text-muted mb-0.5">
                Destinatar
              </p>
              <p className="text-sm text-linear-text-primary">
                {request.recipientName || request.recipientEmail}
              </p>
              {request.recipientName && (
                <p className="text-xs text-linear-text-secondary">{request.recipientEmail}</p>
              )}
            </div>

            {/* Due date */}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-linear-text-muted mb-0.5">
                Termen limita
              </p>
              <p className="text-sm text-linear-text-primary">{formatDate(request.dueDate)}</p>
              {dueDateText && (
                <p
                  className={cn(
                    'text-xs',
                    isPast ? 'text-linear-error' : 'text-linear-text-secondary'
                  )}
                >
                  {dueDateText}
                </p>
              )}
            </div>

            {/* Reminders sent */}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-linear-text-muted mb-0.5">
                Remindere trimise
              </p>
              <p className="text-sm text-linear-text-primary">
                {request.remindersSent} {request.remindersSent === 1 ? 'reminder' : 'remindere'}
              </p>
              {request.lastReminderAt && (
                <p className="text-xs text-linear-text-secondary">
                  Ultimul: {formatDate(request.lastReminderAt)}
                </p>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
