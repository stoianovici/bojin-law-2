'use client';

import { FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatAttachment } from '@/types/chat';

// Note: Download icon removed - download feature planned for future

interface DocumentAttachmentProps {
  attachment: ChatAttachment;
  className?: string;
}

export function DocumentAttachment({ attachment, className }: DocumentAttachmentProps) {
  const handleClick = () => {
    if (attachment.url) {
      window.open(attachment.url, '_blank');
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!attachment.url}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
        'bg-muted/50 hover:bg-muted transition-colors',
        'text-foreground/80',
        !attachment.url && 'cursor-default',
        className
      )}
    >
      <FileText className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="truncate max-w-[150px]">{attachment.name}</span>
      {attachment.url && <ExternalLink className="w-3 h-3 text-muted-foreground" />}
    </button>
  );
}
