'use client';

/**
 * ConversationHeader Component
 * OPS-121: Header for conversation-first thread view
 *
 * Displays thread subject, case name, participant list, and message counts.
 * Compact design that doesn't take too much vertical space.
 */

import { Folder, Users, MessageSquare, Send, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import type { CommunicationThread } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

export interface ConversationHeaderProps {
  thread: CommunicationThread;
  sentCount: number;
  totalCount: number;
  userEmail: string | null;
  /** OPS-201: Callback for new compose button */
  onNewCompose?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function ConversationHeader({
  thread,
  sentCount,
  totalCount,
  userEmail,
  onNewCompose,
}: ConversationHeaderProps) {
  // Get unique participants (excluding the current user for cleaner display)
  const uniqueParticipants = new Set<string>();
  thread.messages.forEach((m) => {
    if (m.senderEmail && m.senderEmail.toLowerCase() !== userEmail?.toLowerCase()) {
      uniqueParticipants.add(m.senderName || m.senderEmail);
    }
  });
  const participantList = Array.from(uniqueParticipants);

  // Format participant display
  const formatParticipants = (): string => {
    if (participantList.length === 0) return 'Fără participanți';
    if (participantList.length === 1) return participantList[0];
    if (participantList.length === 2) return participantList.join(' și ');
    return `${participantList[0]}, ${participantList[1]} și alți ${participantList.length - 2}`;
  };

  const isUnassigned = !thread.caseId;

  return (
    <div className="bg-linear-bg-secondary border-b border-linear-border-subtle px-4 py-3">
      {/* Subject line with new compose button - OPS-201 */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h2 className="font-semibold text-linear-text-primary text-base leading-tight line-clamp-2 flex-1">
          {thread.subject || '(Fără subiect)'}
        </h2>
        {onNewCompose && (
          <button
            onClick={onNewCompose}
            title="Email nou"
            className="flex-shrink-0 p-1.5 rounded-md bg-linear-bg-tertiary text-linear-text-secondary hover:bg-linear-bg-hover hover:text-linear-text-primary transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Metadata row */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-linear-text-tertiary">
        {/* Case badge */}
        <div className={clsx('flex items-center gap-1.5', isUnassigned && 'text-linear-warning')}>
          <Folder className="h-4 w-4" />
          <span className={clsx(isUnassigned && 'font-medium')}>
            {thread.caseName || 'Neatribuit'}
          </span>
        </div>

        {/* Participants */}
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          <span className="truncate max-w-[200px]">{formatParticipants()}</span>
          {userEmail && <span className="text-linear-text-muted">, Dvs.</span>}
        </div>

        {/* Message counts */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            <span>
              {totalCount} {totalCount === 1 ? 'mesaj' : 'mesaje'}
            </span>
          </div>
          {sentCount > 0 && (
            <div className="flex items-center gap-1 text-linear-accent">
              <Send className="h-3.5 w-3.5" />
              <span>
                {sentCount} {sentCount === 1 ? 'trimis' : 'trimise'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

ConversationHeader.displayName = 'ConversationHeader';
