'use client';

import {
  Paperclip,
  MessageSquare,
  LayoutList,
  ExternalLink,
  Edit,
  Folder,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Badge } from '@/components/ui';
import type { EmailThread, ThreadViewMode } from '@/types/email';

interface ConversationHeaderProps {
  thread: EmailThread;
  threadViewMode: ThreadViewMode;
  attachmentPanelOpen: boolean;
  onToggleViewMode: () => void;
  onToggleAttachmentPanel: () => void;
  onNewCompose?: () => void;
  onOpenInOutlook?: () => void;
  onReassign?: () => void;
}

export function ConversationHeader({
  thread,
  threadViewMode,
  attachmentPanelOpen,
  onToggleViewMode,
  onToggleAttachmentPanel,
  onNewCompose,
  onOpenInOutlook,
  onReassign,
}: ConversationHeaderProps) {
  // Get unique participants from email senders
  const participantNames = [
    ...new Set(thread.emails.map((email) => email.from.name || email.from.address)),
  ].join(', ');

  // Count attachments
  const attachmentCount = thread.emails.reduce(
    (count, email) => count + (email.attachments?.length || 0),
    0
  );

  return (
    <div className="px-5 py-4 border-b border-linear-border-subtle bg-linear-bg-primary">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Title and Meta */}
        <div className="flex-1 min-w-0">
          {/* Subject */}
          <h2 className="text-base font-semibold text-linear-text-primary line-clamp-1 mb-1">
            {thread.subject || '(Fără subiect)'}
          </h2>

          {/* Case Badge */}
          <div className="flex items-center gap-2 mb-2">
            {thread.case ? (
              <Badge variant="default" className="text-xs">
                {thread.case.title}
              </Badge>
            ) : (
              <Badge variant="warning" className="text-xs">
                Neatribuit
              </Badge>
            )}
            {thread.case?.caseNumber && (
              <span className="text-xs text-linear-text-tertiary">{thread.case.caseNumber}</span>
            )}
          </div>

          {/* Participants */}
          <div className="text-sm text-linear-text-secondary line-clamp-1">
            {participantNames || 'Fără participanți'}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* View Mode Toggle */}
          <div className="flex bg-linear-bg-tertiary border border-linear-border-subtle rounded-md overflow-hidden">
            <button
              onClick={onToggleViewMode}
              className={cn(
                'p-1.5 transition-colors',
                threadViewMode === 'conversation'
                  ? 'bg-linear-accent text-white'
                  : 'text-linear-text-secondary hover:text-linear-text-primary'
              )}
              title="Vizualizare conversație"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
            <button
              onClick={onToggleViewMode}
              className={cn(
                'p-1.5 transition-colors',
                threadViewMode === 'cards'
                  ? 'bg-linear-accent text-white'
                  : 'text-linear-text-secondary hover:text-linear-text-primary'
              )}
              title="Vizualizare carduri"
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>

          {/* Attachment Panel Toggle */}
          {attachmentCount > 0 && (
            <Button
              variant={attachmentPanelOpen ? 'secondary' : 'ghost'}
              size="sm"
              onClick={onToggleAttachmentPanel}
              className="h-8"
            >
              <Paperclip className="h-4 w-4" />
              <span className="ml-1 text-xs">{attachmentCount}</span>
            </Button>
          )}

          {/* New Compose Button */}
          {onNewCompose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNewCompose}
              className="h-8"
              title="Email nou"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}

          {/* Open in Outlook */}
          {onOpenInOutlook && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenInOutlook}
              className="h-8"
              title="Deschide în Outlook"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}

          {/* Assign/Reassign */}
          {onReassign && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReassign}
              className={cn(
                'h-8',
                !thread.case && 'text-linear-accent bg-linear-accent/10 hover:bg-linear-accent/20'
              )}
            >
              {thread.case ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                  Reasignează
                </>
              ) : (
                <>
                  <Folder className="w-4 h-4 mr-1.5" />
                  Atribuie la dosar
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
