'use client';

import { GripHorizontal, Plus, X, ChevronDown, Mail } from 'lucide-react';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type { MapaSlot, SlotStatus } from '@/types/mapa';
import { slotStatusInfo } from '@/types/mapa';
import { fileTypeColors, formatFileSize } from '@/types/document';
import { RequestStatusBadge } from './RequestStatusBadge';

interface MapaSlotItemProps {
  slot: MapaSlot;
  onAssignDocument?: () => void;
  onRemoveDocument?: () => void;
  onViewDocument?: () => void;
  onStatusChange?: (status: SlotStatus) => void;
  onRequestDocument?: () => void;
  onCancelRequest?: () => void;
  isDragging?: boolean;
}

// File type icon
function FileTypeIcon({ fileType, className }: { fileType: string; className?: string }) {
  const color = fileTypeColors[fileType as keyof typeof fileTypeColors] || fileTypeColors.other;
  return (
    <svg className={className} style={{ color }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
    </svg>
  );
}

// Status badge variant mapping
const statusBadgeVariants: Record<
  SlotStatus,
  'default' | 'info' | 'success' | 'warning' | 'error'
> = {
  pending: 'default',
  requested: 'info',
  received: 'success',
  final: 'success',
};

export function MapaSlotItem({
  slot,
  onAssignDocument,
  onRemoveDocument,
  onViewDocument,
  onStatusChange,
  onRequestDocument,
  onCancelRequest,
  isDragging = false,
}: MapaSlotItemProps) {
  const isFilled = !!slot.document;
  const isEmpty = !slot.document;
  const isRequiredEmpty = isEmpty && slot.required;
  const hasActiveRequest =
    !!slot.documentRequest &&
    slot.documentRequest.status !== 'received' &&
    slot.documentRequest.status !== 'cancelled';
  const statusInfo = slotStatusInfo[slot.status];

  // Get available status transitions based on current state
  const getAvailableTransitions = (): SlotStatus[] => {
    // If no document assigned, can only be pending or requested
    if (!isFilled) {
      return ['pending', 'requested'];
    }
    // If document assigned, can transition to received or final
    return ['received', 'final'];
  };

  // Determine slot styling based on state - no heavy borders
  const slotClasses = cn(
    'rounded-lg p-4 flex items-center gap-4 transition-all',
    'bg-linear-bg-secondary',
    isDragging && 'opacity-50'
  );

  // Order number styling
  const orderClasses = cn(
    'flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium flex-shrink-0',
    isFilled && 'bg-linear-bg-tertiary text-linear-text-secondary',
    isRequiredEmpty && 'bg-linear-error/10 text-linear-error',
    isEmpty && !slot.required && 'bg-linear-bg-tertiary text-linear-text-muted'
  );

  const formattedDate = slot.assignedAt
    ? new Date(slot.assignedAt).toLocaleDateString('ro-RO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className={slotClasses}>
      {/* Order Number */}
      <div className={orderClasses}>{slot.order}</div>

      {/* Slot Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-linear-text-primary">{slot.name}</h3>
          <Badge variant={slot.required ? 'error' : 'default'} className="text-[10px]">
            {slot.required ? 'Obligatoriu' : 'Opțional'}
          </Badge>
          {/* Status Dropdown */}
          {onStatusChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-linear-bg-tertiary hover:bg-linear-bg-hover transition-colors">
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      statusInfo.color === 'gray' && 'bg-linear-text-muted',
                      statusInfo.color === 'blue' && 'bg-linear-info',
                      statusInfo.color === 'green' && 'bg-linear-success',
                      statusInfo.color === 'emerald' && 'bg-emerald-500'
                    )}
                  />
                  <span className="text-linear-text-secondary">{statusInfo.label}</span>
                  <ChevronDown className="w-3 h-3 text-linear-text-muted" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {getAvailableTransitions().map((status) => {
                  const info = slotStatusInfo[status];
                  return (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => onStatusChange(status)}
                      disabled={slot.status === status}
                    >
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full mr-2',
                          info.color === 'gray' && 'bg-linear-text-muted',
                          info.color === 'blue' && 'bg-linear-info',
                          info.color === 'green' && 'bg-linear-success',
                          info.color === 'emerald' && 'bg-emerald-500'
                        )}
                      />
                      {info.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {slot.description && (
          <p className="text-xs text-linear-text-tertiary mt-1">{slot.description}</p>
        )}
        {/* Show active request status */}
        {hasActiveRequest && slot.documentRequest && (
          <div className="flex items-center gap-2 mt-2">
            <RequestStatusBadge request={slot.documentRequest} />
            {onCancelRequest && (
              <button
                onClick={onCancelRequest}
                className="text-xs text-linear-text-muted hover:text-linear-error transition-colors"
              >
                Anulează
              </button>
            )}
          </div>
        )}
      </div>

      {/* Document or Assign Button */}
      {isFilled && slot.document ? (
        <div
          className="flex items-center gap-3 px-3 py-2 rounded-lg bg-linear-bg-tertiary cursor-pointer hover:bg-linear-bg-hover transition-colors"
          onClick={onViewDocument}
        >
          <div
            className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: `${fileTypeColors[slot.document.fileType] || fileTypeColors.other}15`,
            }}
          >
            <FileTypeIcon fileType={slot.document.fileType} className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-linear-text-primary truncate max-w-[180px]">
              {slot.document.fileName}
            </p>
            <p className="text-xs text-linear-text-muted">{formattedDate}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-linear-text-muted hover:text-linear-error"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveDocument?.();
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {/* Assign Document Button */}
          <button
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed transition-colors',
              'hover:border-linear-accent hover:bg-linear-accent/5',
              'border-linear-border-subtle text-linear-text-muted'
            )}
            onClick={onAssignDocument}
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Atribuie</span>
          </button>
          {/* Request Document Button - only show if no active request */}
          {onRequestDocument && !hasActiveRequest && (
            <button
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors',
                'bg-linear-bg-tertiary hover:bg-linear-bg-hover',
                'text-linear-text-secondary hover:text-linear-text-primary'
              )}
              onClick={onRequestDocument}
            >
              <Mail className="w-4 h-4" />
              <span className="text-sm">Solicită</span>
            </button>
          )}
        </div>
      )}

      {/* Drag Handle */}
      <button className="p-1 cursor-grab text-linear-text-muted hover:text-linear-text-secondary">
        <GripHorizontal className="w-4 h-4" />
      </button>
    </div>
  );
}
