'use client';

import { Archive, MoreVertical, Printer, Trash2, Edit2 } from 'lucide-react';
import {
  Card,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Mapa } from '@/types/mapa';
import { MapaCompletionRing } from './MapaCompletionRing';

interface MapaCardProps {
  mapa: Mapa;
  isSelected?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onPrint?: () => void;
  onDelete?: () => void;
}

export function MapaCard({
  mapa,
  isSelected = false,
  onClick,
  onEdit,
  onPrint,
  onDelete,
}: MapaCardProps) {
  const { completionStatus } = mapa;

  return (
    <Card
      className={cn(
        'group p-4 cursor-pointer transition-all duration-150',
        'hover:border-linear-border-default hover:-translate-y-0.5',
        isSelected && 'ring-2 ring-linear-accent border-linear-accent'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        {/* Completion Ring */}
        <MapaCompletionRing completion={completionStatus} size="md" />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-medium text-linear-text-primary">{mapa.name}</h3>
              {mapa.description && (
                <p className="text-xs text-linear-text-tertiary mt-0.5 line-clamp-1">
                  {mapa.description}
                </p>
              )}
            </div>

            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Editează
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onPrint}>
                  <Printer className="w-4 h-4 mr-2" />
                  Tipărește
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-linear-error">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Șterge
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-linear-success" />
              <span className="text-xs text-linear-text-secondary">
                {completionStatus.filledSlots} completate
              </span>
            </div>
            {completionStatus.missingRequired.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-linear-error" />
                <span className="text-xs text-linear-text-secondary">
                  {completionStatus.missingRequired.length} obligatorii lipsă
                </span>
              </div>
            )}
            {completionStatus.totalSlots -
              completionStatus.filledSlots -
              completionStatus.missingRequired.length >
              0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-linear-text-muted" />
                <span className="text-xs text-linear-text-secondary">
                  {completionStatus.totalSlots - completionStatus.filledSlots} opționale goale
                </span>
              </div>
            )}
          </div>

          {/* Slot count */}
          <div className="mt-2 text-xs text-linear-text-muted">
            {completionStatus.filledSlots}/{completionStatus.totalSlots} sloturi
          </div>
        </div>
      </div>
    </Card>
  );
}

// Compact version for sidebar
interface MapaSidebarItemProps {
  mapa: Mapa;
  isSelected?: boolean;
  onClick?: () => void;
}

export function MapaSidebarItem({ mapa, isSelected, onClick }: MapaSidebarItemProps) {
  const { completionStatus } = mapa;

  // Status dot color
  let dotColor = 'bg-linear-warning';
  if (completionStatus.isComplete) {
    dotColor = 'bg-linear-success';
  }

  return (
    <button
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
        isSelected
          ? 'bg-linear-accent-muted text-linear-accent'
          : 'text-linear-text-secondary hover:bg-linear-bg-hover'
      )}
      onClick={onClick}
    >
      <Archive className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1 text-left truncate">{mapa.name}</span>
      <div className="flex items-center gap-1">
        <span className="text-xs">
          {completionStatus.filledSlots}/{completionStatus.totalSlots}
        </span>
        <div className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />
      </div>
    </button>
  );
}
