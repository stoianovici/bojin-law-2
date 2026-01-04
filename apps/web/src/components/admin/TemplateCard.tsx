'use client';

import { Lock, MoreVertical, Eye, Copy, FileText } from 'lucide-react';
import {
  Card,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type { MapaTemplate } from '@/types/mapa';

interface TemplateCardProps {
  template: MapaTemplate;
  onView?: () => void;
  onDuplicate?: () => void;
}

export function TemplateCard({ template, onView, onDuplicate }: TemplateCardProps) {
  const slotCount = template.slotDefinitions.length;

  // Format last synced timestamp
  const formattedLastSynced = template.lastSynced
    ? new Date(template.lastSynced).toLocaleDateString('ro-RO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <Card
      className={cn(
        'group p-4 transition-all duration-150',
        'hover:border-linear-border-default hover:-translate-y-0.5'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-linear-bg-tertiary flex items-center justify-center">
            <FileText className="w-5 h-5 text-linear-text-secondary" />
          </div>

          {/* Title and badges */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-medium text-linear-text-primary truncate">
                {template.name}
              </h3>
              {template.isLocked && (
                <Lock className="w-3.5 h-3.5 text-linear-text-muted flex-shrink-0" />
              )}
              {template.isONRC && (
                <Badge variant="info" size="sm">
                  ONRC
                </Badge>
              )}
            </div>
            {template.description && (
              <p className="text-xs text-linear-text-tertiary mt-0.5 line-clamp-2">
                {template.description}
              </p>
            )}
          </div>
        </div>

        {/* Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView}>
              <Eye className="w-4 h-4 mr-2" />
              View
            </DropdownMenuItem>
            {!template.isONRC && (
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mt-4">
        <Badge variant="default" size="sm">
          {slotCount} {slotCount === 1 ? 'slot' : 'slots'}
        </Badge>
        <span className="text-xs text-linear-text-muted">
          {template.usageCount} {template.usageCount === 1 ? 'use' : 'uses'}
        </span>
      </div>

      {/* Last synced (for ONRC templates) */}
      {template.isONRC && formattedLastSynced && (
        <div className="mt-3 pt-3 border-t border-linear-border-subtle">
          <span className="text-xs text-linear-text-muted">Last synced: {formattedLastSynced}</span>
        </div>
      )}
    </Card>
  );
}
