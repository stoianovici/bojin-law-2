'use client';

import {
  Paperclip,
  ExternalLink,
  Edit,
  Folder,
  RefreshCw,
  User,
  Globe,
  Lock,
  MoreVertical,
  Loader2,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui';
import { useAuthStore, isPartnerDb } from '@/store/authStore';
import type { EmailThread, ClientActiveCase } from '@/types/email';

interface ConversationHeaderProps {
  thread: EmailThread;
  attachmentPanelOpen: boolean;
  onToggleAttachmentPanel: () => void;
  onNewCompose?: () => void;
  onOpenInOutlook?: () => void;
  onReassign?: () => void;
  onMarkSenderAsPersonal?: () => void;
  /** Handler for toggling thread privacy (true = make public, false = make private) */
  onTogglePrivacy?: (makePublic: boolean) => void;
  /** Whether the privacy toggle action is loading */
  togglingPrivacy?: boolean;
  /** Whether this is a client inbox email (known client, multiple cases) */
  isClientInbox?: boolean;
  /** Client's cases for dropdown assignment (client inbox mode) */
  clientCases?: ClientActiveCase[];
  /** Client name for dropdown label */
  clientName?: string;
  /** Handler for direct case assignment from dropdown */
  onAssignToCase?: (caseId: string) => Promise<void>;
  /** Whether assignment is in progress */
  assigningToCase?: boolean;
}

export function ConversationHeader({
  thread,
  attachmentPanelOpen,
  onToggleAttachmentPanel,
  onNewCompose,
  onOpenInOutlook,
  onReassign,
  onMarkSenderAsPersonal,
  onTogglePrivacy,
  togglingPrivacy,
  isClientInbox = false,
  clientCases,
  clientName,
  onAssignToCase,
  assigningToCase = false,
}: ConversationHeaderProps) {
  const { user } = useAuthStore();

  // Treat client inbox as "assigned" for UI purposes (hide Contact personal, show privacy)
  const isAssignedOrClientInbox = !!thread.case || isClientInbox;

  // Check if current user can toggle this thread's privacy
  // Only the owner (Partner/BusinessOwner) can toggle their own thread's privacy
  // Privacy toggle shows for assigned emails OR client inbox (not truly uncategorized)
  const canTogglePrivacy =
    isAssignedOrClientInbox && user && isPartnerDb(user.dbRole) && thread.userId === user.id;
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
            {thread.case?.referenceNumbers?.[0] && (
              <span className="text-xs text-linear-text-tertiary">
                {thread.case.referenceNumbers[0]}
              </span>
            )}
          </div>

          {/* Participants */}
          <div className="text-sm text-linear-text-secondary line-clamp-1">
            {participantNames || 'Fără participanți'}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
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

          {/* Assign/Reassign - Dropdown for client inbox, button otherwise */}
          {/* Only show dropdown if: thread not assigned OR multiple cases available to reassign */}
          {clientCases &&
          clientCases.length > 0 &&
          onAssignToCase &&
          (!thread.case || clientCases.length > 1) ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={thread.case ? 'ghost' : 'primary'}
                  size="sm"
                  className="h-8"
                  disabled={assigningToCase}
                >
                  {assigningToCase ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      Se atribuie...
                    </>
                  ) : thread.case ? (
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
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {clientName && (
                  <>
                    <DropdownMenuLabel className="text-xs text-linear-text-tertiary">
                      Dosarele {clientName}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                  </>
                )}
                {clientCases.map((caseItem) => (
                  <DropdownMenuItem
                    key={caseItem.id}
                    onSelect={() => onAssignToCase(caseItem.id)}
                    disabled={thread.case?.id === caseItem.id}
                    className="flex items-center gap-2"
                  >
                    <Folder className="w-4 h-4 text-linear-text-tertiary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {caseItem.referenceNumbers?.[0] && (
                        <div className="text-xs text-linear-text-secondary">
                          {caseItem.referenceNumbers[0]}
                        </div>
                      )}
                      <div className="text-sm truncate">{caseItem.title}</div>
                    </div>
                    {thread.case?.id === caseItem.id && (
                      <Check className="w-4 h-4 text-linear-accent flex-shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : onReassign && !(clientCases && clientCases.length === 1 && thread.case) ? (
            /* Hide reassign button in client inbox mode when there's only 1 case and thread is already assigned */
            <Button
              variant={thread.case ? 'ghost' : 'primary'}
              size="sm"
              onClick={onReassign}
              className="h-8"
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
          ) : null}

          {/* Contact Personal - only for truly unassigned threads (not client inbox) */}
          {!isAssignedOrClientInbox && onMarkSenderAsPersonal && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkSenderAsPersonal}
              className="h-8"
              title="Marchează expeditorul ca contact personal"
            >
              <User className="w-4 h-4 mr-1.5" />
              Contact personal
            </Button>
          )}

          {/* Privacy Icon Toggle - only for assigned threads + owner */}
          {canTogglePrivacy && onTogglePrivacy && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTogglePrivacy(!!thread.isPrivate)}
              disabled={togglingPrivacy}
              className={cn(
                'h-8 w-8 p-0',
                togglingPrivacy && 'opacity-50 cursor-wait',
                thread.isPrivate
                  ? 'text-orange-500 hover:text-orange-400'
                  : 'text-green-500 hover:text-green-400'
              )}
              title={
                thread.isPrivate
                  ? 'Privat - click pentru a face public'
                  : 'Public - click pentru a face privat'
              }
            >
              {thread.isPrivate ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
            </Button>
          )}

          {/* Overflow Menu */}
          {(onOpenInOutlook || onNewCompose) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onOpenInOutlook && (
                  <DropdownMenuItem onSelect={onOpenInOutlook}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Deschide în Outlook
                  </DropdownMenuItem>
                )}
                {onNewCompose && (
                  <DropdownMenuItem onSelect={onNewCompose}>
                    <Edit className="w-4 h-4 mr-2" />
                    Email nou
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}
