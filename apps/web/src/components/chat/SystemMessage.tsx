'use client';

import { Bot, FileText, CheckSquare, Calendar, FolderOpen } from 'lucide-react';
// Note: CheckCircle icon removed - using CheckSquare for task completion
import { cn } from '@/lib/utils';
import { DocumentAttachment } from './DocumentAttachment';
import type { ChatAttachment } from '@/types/chat';

interface SystemMessageProps {
  content: string;
  activityType?: string;
  timestamp: Date;
  attachments?: ChatAttachment[];
}

const ACTIVITY_ICONS: Record<string, typeof Bot> = {
  doc_upload: FileText,
  task_created: CheckSquare,
  task_completed: CheckSquare,
  calendar_event: Calendar,
  mapa_created: FolderOpen,
  mapa_completed: FolderOpen,
};

export function SystemMessage({
  content,
  activityType,
  timestamp,
  attachments,
}: SystemMessageProps) {
  const Icon = activityType ? ACTIVITY_ICONS[activityType] || Bot : Bot;

  return (
    <div className="flex items-start gap-2 py-1.5 px-3 text-sm text-muted-foreground">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <span>{content}</span>
        {attachments && attachments.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {attachments.map((attachment) => (
              <DocumentAttachment key={attachment.id} attachment={attachment} />
            ))}
          </div>
        )}
      </div>
      <span className="text-xs text-muted-foreground/60 flex-shrink-0">
        {timestamp.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}
