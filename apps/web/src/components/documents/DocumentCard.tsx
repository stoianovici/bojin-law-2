'use client';

import { useState } from 'react';
import { Trash2, Edit2, FolderInput, Lock, Globe, Send, CheckCircle2 } from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAuthStore, isPartnerDb } from '@/store/authStore';
import { useDocumentPrivacy } from '@/hooks/cache';
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
  onPrivacyChange?: () => void;
  /** Mark DRAFT document as ready for review (author only) */
  onMarkReadyForReview?: () => void;
  /** Mark READY_FOR_REVIEW document as final (supervisor only) */
  onMarkFinal?: () => void;
  /** Whether current user is a supervisor for this document's case */
  isSupervisor?: boolean;
}

// Map document status to badge variant (using Badge component's actual variants)
const documentStatusBadgeVariants: Record<Document['status'], BadgeVariant> = {
  DRAFT: 'warning',
  READY_FOR_REVIEW: 'info',
  FINAL: 'success',
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
  onPrivacyChange,
  onMarkReadyForReview,
  onMarkFinal,
  isSupervisor = false,
}: DocumentCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { user } = useAuthStore();

  // Check if current user is the author of this document (for Submit for Review)
  const isAuthor = user && document.uploadedBy.id === user.id;

  // Check if current user owns this document (Partner/BusinessOwner) - for privacy toggle
  const isOwner = user && isPartnerDb(user.dbRole) && document.uploadedBy.id === user.id;

  // Use the cache-aware privacy hook with optimistic updates
  const { togglePrivacy, loading: isTogglingPrivacy } = useDocumentPrivacy({
    onSuccess: () => {
      onPrivacyChange?.();
    },
    onError: (err: Error) => {
      console.error('[DocumentCard] Failed to toggle document privacy:', err);
    },
  });

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
        isSelected && 'ring-2 ring-linear-accent border-linear-accent',
        // Private-by-Default: orange right border for private documents
        document.isPrivate && 'border-r-2 border-r-orange-500'
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
          {/* For email attachments, show sender info; otherwise show uploadedBy */}
          {document.senderName || document.senderEmail ? (
            <>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium bg-orange-500/15 text-orange-500">
                {document.senderName
                  ? document.senderName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)
                      .toUpperCase()
                  : document.senderEmail?.substring(0, 2).toUpperCase()}
              </div>
              <span className="text-xs text-linear-text-secondary truncate">
                {document.senderName || document.senderEmail}
              </span>
            </>
          ) : (
            <>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium bg-linear-accent/15 text-linear-accent">
                {document.uploadedBy.initials}
              </div>
              <span className="text-xs text-linear-text-secondary">
                {document.uploadedBy.firstName} {document.uploadedBy.lastName}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Actions Bar - always visible */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-linear-border-subtle">
        {/* Left side - workflow actions */}
        <div className="flex items-center gap-1">
          {/* Submit for Review - only for DRAFT documents, author only */}
          {document.status === 'DRAFT' && onMarkReadyForReview && isAuthor && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-linear-text-secondary hover:text-linear-text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onMarkReadyForReview();
              }}
              title="Trimite la revizuire"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          )}
          {/* Mark as Final - only for READY_FOR_REVIEW documents, supervisor only */}
          {document.status === 'READY_FOR_REVIEW' && onMarkFinal && isSupervisor && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-green-500 hover:text-green-400"
              onClick={(e) => {
                e.stopPropagation();
                onMarkFinal();
              }}
              title="Marchează ca final"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </Button>
          )}
          {/* Assign to Mapa */}
          {onAssignToMapa && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-linear-text-secondary hover:text-linear-text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onAssignToMapa();
              }}
              title="Atribuie unei mape"
            >
              <FolderInput className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/* Right side - privacy, rename, delete */}
        <div className="flex items-center gap-1">
          {/* Privacy toggle */}
          {isOwner && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (isTogglingPrivacy) return;
                togglePrivacy(document.id, document.isPrivate ?? false);
              }}
              className={cn(
                'h-7 w-7 p-0 rounded-md flex items-center justify-center hover:bg-linear-bg-tertiary transition-colors',
                isTogglingPrivacy && 'opacity-50 cursor-wait',
                document.isPrivate
                  ? 'text-orange-500 hover:text-orange-400'
                  : 'text-green-500 hover:text-green-400'
              )}
              title={
                document.isPrivate
                  ? 'Privat - click pentru a face public'
                  : 'Public - click pentru a face privat'
              }
            >
              {document.isPrivate ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Globe className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          {/* Rename */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-linear-text-secondary hover:text-linear-text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onRename?.();
            }}
            title="Redenumește"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          {/* Delete */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-linear-text-secondary hover:text-linear-error"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            title="Șterge"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
