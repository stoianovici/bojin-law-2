'use client';

import { useState } from 'react';
import { Trash2, Edit2, FolderInput, Lock, Globe, Send, CheckCircle2 } from 'lucide-react';
import { useMutation } from '@apollo/client/react';
import { Checkbox, Badge, Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAuthStore, isPartnerDb } from '@/store/authStore';
import { MARK_DOCUMENT_PUBLIC } from '@/graphql/mutations';
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
  onOpenInWord,
  onDownload,
  onRename,
  onDelete,
  onAssignToMapa,
  onPrivacyChange,
  onMarkReadyForReview,
  onMarkFinal,
  isSupervisor = false,
}: DocumentListItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { user } = useAuthStore();

  // Check if current user is the author of this document (for Submit for Review)
  const isAuthor = user && document.uploadedBy.id === user.id;

  // Check if current user owns this document (Partner/BusinessOwner) - for privacy toggle
  const isOwner = user && isPartnerDb(user.dbRole) && document.uploadedBy.id === user.id;
  // Can only make public if it's currently private and user is owner
  const canMakePublic = document.isPrivate && isOwner;

  const [markDocumentPublic, { loading: markingPublic }] = useMutation(MARK_DOCUMENT_PUBLIC, {
    onCompleted: () => {
      onPrivacyChange?.();
    },
    onError: (err: Error) => {
      console.error('[DocumentListItem] Failed to mark document public:', err);
    },
  });

  // Check if this is a Word document
  const isWordDocument =
    document.fileName.toLowerCase().endsWith('.docx') ||
    document.fileName.toLowerCase().endsWith('.doc');

  // Handle click - open Word for Word docs, otherwise use onClick
  const handleClick = () => {
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
    <div
      className={cn(
        'group flex items-center gap-4 px-4 py-3 rounded-lg transition-colors cursor-pointer',
        'hover:bg-linear-bg-hover',
        isSelected && 'bg-linear-accent-muted',
        // Private-by-Default: orange right border for private documents
        document.isPrivate && 'border-r-2 border-r-orange-500'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
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
      </div>

      {/* Modified Date */}
      <div className="w-28 flex-shrink-0">
        <span className="text-sm text-linear-text-secondary">{formattedDate}</span>
      </div>

      {/* Uploader / Sender */}
      <div className="w-36 flex-shrink-0 flex items-center gap-2">
        {/* For email attachments, show sender info; otherwise show uploadedBy */}
        {document.senderName || document.senderEmail ? (
          <>
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
              style={{
                backgroundColor: 'rgba(249, 115, 22, 0.15)',
                color: '#f97316',
              }}
            >
              {document.senderName
                ? document.senderName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()
                : document.senderEmail?.substring(0, 2).toUpperCase()}
            </div>
            <span className="text-sm text-linear-text-secondary truncate">
              {document.senderName || document.senderEmail}
            </span>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* File Size */}
      <div className="w-20 flex-shrink-0 text-right">
        <span className="text-sm text-linear-text-tertiary">
          {formatFileSize(document.fileSize)}
        </span>
      </div>

      {/* Actions - always visible */}
      <div className="flex-shrink-0 flex items-center gap-1">
        {/* Submit for Review - only for DRAFT documents, author only */}
        {document.status === 'DRAFT' && onMarkReadyForReview && isAuthor && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-linear-text-secondary hover:text-linear-text-primary"
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
            className="h-7 w-7 p-0 text-green-500 hover:text-green-400"
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
            className="h-7 w-7 p-0 text-linear-text-secondary hover:text-linear-text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onAssignToMapa();
            }}
            title="Atribuie unei mape"
          >
            <FolderInput className="w-3.5 h-3.5" />
          </Button>
        )}
        {/* Privacy toggle */}
        {isOwner && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (canMakePublic && !markingPublic) {
                markDocumentPublic({ variables: { documentId: document.id } });
              }
            }}
            className={cn(
              'h-7 w-7 p-0 rounded-md flex items-center justify-center hover:bg-linear-bg-tertiary transition-colors',
              markingPublic && 'opacity-50 cursor-wait',
              document.isPrivate
                ? 'text-orange-500 hover:text-orange-400'
                : 'text-green-500 hover:text-green-400'
            )}
            title={document.isPrivate ? 'Privat - click pentru a face public' : 'Public'}
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
  );
}
