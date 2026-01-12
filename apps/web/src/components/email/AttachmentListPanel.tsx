'use client';

import { X, FileText, Image, File, ExternalLink, Lock, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, ScrollArea, Switch } from '@/components/ui';
import type { Attachment } from '@/types/email';

interface AttachmentListPanelProps {
  attachments: Attachment[];
  onClose: () => void;
  onPreview: (attachment: Attachment) => void;
  /** Whether current user can toggle attachment privacy */
  canTogglePrivacy?: boolean;
  /** Handler for toggling attachment privacy (true = make public, false = make private) */
  onTogglePrivacy?: (attachmentId: string, makePublic: boolean) => void;
  /** ID of attachment currently having privacy toggled (loading state) */
  togglingPrivacyId?: string | null;
  className?: string;
}

export function AttachmentListPanel({
  attachments,
  onClose,
  onPreview,
  canTogglePrivacy,
  onTogglePrivacy,
  togglingPrivacyId,
  className,
}: AttachmentListPanelProps) {
  return (
    <div
      className={cn(
        'w-80 xl:w-[400px] min-w-0 flex-shrink-0 flex flex-col bg-linear-bg-primary border-l border-linear-border-subtle overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-linear-border-subtle">
        <span className="text-sm font-semibold text-linear-text-primary">
          Atașamente ({attachments.length})
        </span>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Attachment List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {attachments.map((attachment) => (
            <AttachmentItem
              key={attachment.id}
              attachment={attachment}
              onPreview={() => onPreview(attachment)}
              canTogglePrivacy={canTogglePrivacy}
              onTogglePrivacy={onTogglePrivacy}
              isToggling={togglingPrivacyId === attachment.id}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Footer Hint */}
      <div className="px-4 py-3 border-t border-linear-border-subtle bg-linear-bg-tertiary">
        <p className="text-xs text-linear-text-tertiary text-center">
          Click pe un atașament pentru previzualizare completă
        </p>
      </div>
    </div>
  );
}

interface AttachmentItemProps {
  attachment: Attachment;
  onPreview: () => void;
  canTogglePrivacy?: boolean;
  onTogglePrivacy?: (attachmentId: string, makePublic: boolean) => void;
  isToggling?: boolean;
}

function AttachmentItem({
  attachment,
  onPreview,
  canTogglePrivacy,
  onTogglePrivacy,
  isToggling,
}: AttachmentItemProps) {
  const name = attachment.name || attachment.filename || 'Atașament';
  const size = formatFileSize(attachment.size || attachment.fileSize || 0);
  const { icon: Icon, color } = getFileTypeInfo(
    attachment.mimeType || attachment.contentType || ''
  );

  return (
    <div
      className={cn(
        'w-full flex flex-col gap-2 p-3',
        'bg-linear-bg-elevated border border-linear-border-subtle rounded-lg'
      )}
    >
      {/* Main Row: File Info + Preview */}
      <button
        onClick={onPreview}
        className={cn(
          'w-full min-w-0 flex items-center gap-3',
          'hover:opacity-80 transition-opacity',
          'text-left cursor-pointer overflow-hidden'
        )}
      >
        {/* File Icon */}
        <div
          className={cn(
            'w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg',
            'bg-linear-bg-tertiary'
          )}
        >
          <Icon className={cn('h-5 w-5', color)} />
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-linear-text-primary truncate" title={name}>
            {name}
          </div>
          <div className="text-xs text-linear-text-tertiary">
            {getFileTypeLabel(attachment.mimeType || attachment.contentType || '')} • {size}
          </div>
        </div>

        {/* Preview Icon */}
        <ExternalLink className="h-4 w-4 text-linear-text-tertiary flex-shrink-0" />
      </button>

      {/* Privacy Toggle Row */}
      {canTogglePrivacy && onTogglePrivacy && (
        <div className="flex items-center justify-between pl-[52px]">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex items-center gap-1 text-xs transition-colors',
                attachment.isPrivate ? 'text-orange-500' : 'text-linear-text-tertiary'
              )}
            >
              <Lock className="w-3 h-3" />
              Privat
            </span>
            <Switch
              checked={!attachment.isPrivate}
              onCheckedChange={(checked) => onTogglePrivacy(attachment.id, checked)}
              disabled={isToggling}
              className={cn(
                isToggling && 'opacity-50 cursor-wait',
                'data-[state=unchecked]:bg-orange-500/30 data-[state=checked]:bg-green-500'
              )}
              title={attachment.isPrivate ? 'Fă public pentru echipă' : 'Fă privat'}
            />
            <span
              className={cn(
                'flex items-center gap-1 text-xs transition-colors',
                !attachment.isPrivate ? 'text-green-500' : 'text-linear-text-tertiary'
              )}
            >
              <Globe className="w-3 h-3" />
              Public
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Get file type info (icon and color)
function getFileTypeInfo(mimeType: string): { icon: typeof File; color: string } {
  const type = mimeType.toLowerCase();

  if (type.includes('pdf')) {
    return { icon: FileText, color: 'text-red-400' };
  } else if (type.includes('image')) {
    return { icon: Image, color: 'text-green-400' };
  } else if (type.includes('word') || type.includes('document')) {
    return { icon: FileText, color: 'text-blue-400' };
  } else if (type.includes('excel') || type.includes('spreadsheet')) {
    return { icon: FileText, color: 'text-emerald-400' };
  } else if (type.includes('powerpoint') || type.includes('presentation')) {
    return { icon: FileText, color: 'text-orange-400' };
  } else {
    return { icon: File, color: 'text-linear-text-tertiary' };
  }
}

// Get human-readable file type label
function getFileTypeLabel(mimeType: string): string {
  const type = mimeType.toLowerCase();

  if (type.includes('pdf')) return 'PDF';
  if (type.includes('image/jpeg') || type.includes('image/jpg')) return 'JPEG';
  if (type.includes('image/png')) return 'PNG';
  if (type.includes('image/gif')) return 'GIF';
  if (type.includes('image')) return 'Imagine';
  if (type.includes('word')) return 'Word';
  if (type.includes('excel') || type.includes('spreadsheet')) return 'Excel';
  if (type.includes('powerpoint') || type.includes('presentation')) return 'PowerPoint';
  if (type.includes('text/plain')) return 'Text';
  if (type.includes('zip') || type.includes('archive')) return 'Arhivă';

  return 'Fișier';
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
