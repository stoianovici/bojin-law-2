'use client';

import { Check, Loader2, AlertCircle, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'needs-review';

export interface TemplateSyncStatusProps {
  status: SyncStatus;
  lastSynced?: string;
  error?: string;
  className?: string;
}

const statusConfig: Record<
  SyncStatus,
  {
    icon: React.ReactNode;
    label: string;
    variant: 'success' | 'warning' | 'error' | 'info';
    iconClassName: string;
  }
> = {
  synced: {
    icon: <Check className="w-3 h-3" />,
    label: 'Sincronizat',
    variant: 'success',
    iconClassName: 'text-linear-success',
  },
  syncing: {
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    label: 'Se sincronizează',
    variant: 'info',
    iconClassName: 'text-linear-accent',
  },
  error: {
    icon: <AlertCircle className="w-3 h-3" />,
    label: 'Eroare',
    variant: 'error',
    iconClassName: 'text-linear-error',
  },
  'needs-review': {
    icon: <AlertTriangle className="w-3 h-3" />,
    label: 'Necesită revizuire',
    variant: 'warning',
    iconClassName: 'text-linear-warning',
  },
};

export function TemplateSyncStatus({
  status,
  lastSynced,
  error,
  className,
}: TemplateSyncStatusProps) {
  const config = statusConfig[status];

  const formattedTime = lastSynced
    ? formatDistanceToNow(new Date(lastSynced), { addSuffix: true })
    : null;

  const content = (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <Badge
        variant={config.variant}
        icon={<span className={config.iconClassName}>{config.icon}</span>}
      >
        {config.label}
      </Badge>
      {formattedTime && <span className="text-xs text-linear-text-tertiary">{formattedTime}</span>}
    </div>
  );

  // Wrap in tooltip if there's an error message
  if (status === 'error' && error) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">{content}</div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs text-linear-error">{error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}
