'use client';

import { useState } from 'react';
import { MoreVertical, Eye, Download, Trash2, Edit2, FolderInput } from 'lucide-react';
import {
  Checkbox,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Document } from '@/types/document';
import {
  fileTypeColors,
  statusLabels,
  formatFileSize,
  statusBadgeVariants,
} from '@/types/document';

interface DocumentListItemProps {
  document: Document;
  isSelected?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  onPreview?: () => void;
  onDownload?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onAssignToMapa?: () => void;
}

// File type icon
function FileTypeIcon({
  fileType,
  className,
}: {
  fileType: Document['fileType'];
  className?: string;
}) {
  const color = fileTypeColors[fileType];
  return (
    <svg className={className} style={{ color }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
    </svg>
  );
}

export function DocumentListItem({
  document,
  isSelected = false,
  onSelect,
  onClick,
  onPreview,
  onDownload,
  onRename,
  onDelete,
  onAssignToMapa,
}: DocumentListItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const formattedDate = new Date(document.uploadedAt).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      className={cn(
        'group flex items-center gap-4 px-4 py-3 rounded-lg transition-colors cursor-pointer',
        'hover:bg-linear-bg-hover',
        isSelected && 'bg-linear-accent-muted'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Checkbox */}
      <div
        className={cn('transition-opacity', isHovered || isSelected ? 'opacity-100' : 'opacity-0')}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect?.()}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* File Icon */}
      <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 bg-linear-bg-tertiary">
        <FileTypeIcon fileType={document.fileType} className="w-4 h-4" />
      </div>

      {/* File Name & Status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-linear-text-primary truncate">
            {document.fileName}
          </span>
          <Badge
            variant={statusBadgeVariants[document.status]}
            className="text-[10px] flex-shrink-0"
          >
            {statusLabels[document.status]}
          </Badge>
        </div>
        {document.assignedToMapaId && (
          <span className="text-xs text-linear-text-muted">Assigned to mapa</span>
        )}
      </div>

      {/* Modified Date */}
      <div className="w-28 flex-shrink-0">
        <span className="text-sm text-linear-text-secondary">{formattedDate}</span>
      </div>

      {/* Uploader */}
      <div className="w-36 flex-shrink-0 flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
          style={{
            backgroundColor: 'rgba(94, 106, 210, 0.15)',
            color: '#5E6AD2',
          }}
        >
          {document.uploadedBy.initials}
        </div>
        <span className="text-sm text-linear-text-secondary truncate">
          {document.uploadedBy.firstName} {document.uploadedBy.lastName}
        </span>
      </div>

      {/* File Size */}
      <div className="w-20 flex-shrink-0 text-right">
        <span className="text-sm text-linear-text-tertiary">
          {formatFileSize(document.fileSize)}
        </span>
      </div>

      {/* Actions */}
      <div
        className={cn('flex-shrink-0 transition-opacity', isHovered ? 'opacity-100' : 'opacity-0')}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onPreview}>
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRename}>
              <Edit2 className="w-4 h-4 mr-2" />
              Rename
            </DropdownMenuItem>
            {!document.assignedToMapaId && (
              <DropdownMenuItem onClick={onAssignToMapa}>
                <FolderInput className="w-4 h-4 mr-2" />
                Assign to Mapa
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-linear-error">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
