'use client';

import { useState } from 'react';
import { Eye, MoreVertical, Download, Trash2, Edit2, FolderInput } from 'lucide-react';
import {
  Card,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Document, FileType } from '@/types/document';
import { fileTypeColors, statusLabels, formatFileSize } from '@/types/document';
import type { BadgeVariant } from '@/components/ui/badge';

interface DocumentCardProps {
  document: Document;
  isSelected?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  onPreview?: () => void;
  onOpenInWord?: () => void;
  onDownload?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onAssignToMapa?: () => void;
}

// Map document status to badge variant (using Badge component's actual variants)
const documentStatusBadgeVariants: Record<Document['status'], BadgeVariant> = {
  DRAFT: 'warning',
  PENDING: 'info',
  FINAL: 'success',
  ARCHIVED: 'default',
};

// File type icon component
function FileTypeIcon({ fileType, className }: { fileType: FileType; className?: string }) {
  const color = fileTypeColors[fileType];
  return (
    <svg className={className} style={{ color }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
    </svg>
  );
}

export function DocumentCard({
  document,
  isSelected = false,
  onSelect,
  onClick,
  onPreview,
  onOpenInWord,
  onDownload,
  onRename,
  onDelete,
  onAssignToMapa,
}: DocumentCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Check if this is a Word document
  const isWordDocument =
    document.fileName.toLowerCase().endsWith('.docx') ||
    document.fileName.toLowerCase().endsWith('.doc');

  // Handle card click - open Word for Word docs, otherwise use onClick
  const handleCardClick = () => {
    if (isWordDocument && onOpenInWord) {
      onOpenInWord();
    } else {
      onClick?.();
    }
  };

  const formattedDate = new Date(document.uploadedAt).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Card
      className={cn(
        'group p-4 cursor-pointer transition-all duration-150',
        'hover:border-linear-border-default hover:-translate-y-0.5',
        isSelected && 'ring-2 ring-linear-accent border-linear-accent'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* Thumbnail */}
      <div className="aspect-[4/3] rounded-lg mb-3 flex items-center justify-center relative overflow-hidden bg-linear-bg-tertiary">
        <FileTypeIcon fileType={document.fileType} className="w-12 h-12" />

        {/* Status Badge */}
        <Badge
          variant={documentStatusBadgeVariants[document.status]}
          size="sm"
          className="absolute top-2 right-2"
        >
          {statusLabels[document.status]}
        </Badge>

        {/* Selection checkbox overlay */}
        {onSelect && (
          <div
            className={cn(
              'absolute top-2 left-2 transition-opacity',
              isHovered || isSelected ? 'opacity-100' : 'opacity-0'
            )}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 rounded border-linear-border-default bg-linear-bg-secondary"
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-linear-text-primary truncate">
          {document.fileName}
        </h4>
        <div className="flex items-center gap-2 text-xs text-linear-text-tertiary">
          <span>{formatFileSize(document.fileSize)}</span>
          <span>•</span>
          <span>{formattedDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium bg-linear-accent/15 text-linear-accent">
            {document.uploadedBy.initials}
          </div>
          <span className="text-xs text-linear-text-secondary">
            {document.uploadedBy.firstName} {document.uploadedBy.lastName}
          </span>
        </div>
      </div>

      {/* Hover Actions */}
      <div
        className={cn(
          'flex items-center gap-2 mt-3 pt-3 border-t border-linear-border-subtle transition-opacity',
          isHovered ? 'opacity-100' : 'opacity-0'
        )}
      >
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-8 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onPreview?.();
          }}
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" />
          Previzualizare
        </Button>

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
              Previzualizare
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDownload}>
              <Download className="w-4 h-4 mr-2" />
              Descarcă
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRename}>
              <Edit2 className="w-4 h-4 mr-2" />
              Redenumește
            </DropdownMenuItem>
            {!document.assignedToMapaId && (
              <DropdownMenuItem onClick={onAssignToMapa}>
                <FolderInput className="w-4 h-4 mr-2" />
                Atribuie unei mape
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-linear-error">
              <Trash2 className="w-4 h-4 mr-2" />
              Șterge
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
