/**
 * DeadlineActionMenu - Dropdown menu with suggested deadline actions
 * Story 5.4: Proactive AI Suggestions System (Task 29)
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DeadlineInfo, SuggestedAction } from '@legal-platform/types';

// Icons
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const TaskIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
);

const MailIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const DocumentIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const ExternalLinkIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

export interface DeadlineActionMenuProps {
  deadline: DeadlineInfo;
  onCreateTask?: (deadline: DeadlineInfo) => void;
  onSendReminder?: (deadline: DeadlineInfo) => void;
  onRequestExtension?: (deadline: DeadlineInfo) => void;
  onMarkHandled?: (deadline: DeadlineInfo) => void;
  onActionSelect?: (action: SuggestedAction, deadline: DeadlineInfo) => void;
  triggerLabel?: string;
  triggerVariant?: 'default' | 'ghost' | 'outline';
  triggerSize?: 'sm' | 'default' | 'lg';
}

const actionTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  create_task: TaskIcon,
  CreateTask: TaskIcon,
  send_email: MailIcon,
  SendEmail: MailIcon,
  schedule_meeting: CalendarIcon,
  ScheduleMeeting: CalendarIcon,
  review_document: DocumentIcon,
  ReviewDocument: DocumentIcon,
  navigate: ExternalLinkIcon,
  Navigate: ExternalLinkIcon,
};

/**
 * DeadlineActionMenu displays a dropdown with suggested actions
 * for handling upcoming deadlines.
 */
export function DeadlineActionMenu({
  deadline,
  onCreateTask,
  onSendReminder,
  onRequestExtension,
  onMarkHandled,
  onActionSelect,
  triggerLabel = 'Acțiuni',
  triggerVariant = 'outline',
  triggerSize = 'sm',
}: DeadlineActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleCreateTask = () => {
    onCreateTask?.(deadline);
    setIsOpen(false);
  };

  const handleSendReminder = () => {
    onSendReminder?.(deadline);
    setIsOpen(false);
  };

  const handleRequestExtension = () => {
    onRequestExtension?.(deadline);
    setIsOpen(false);
  };

  const handleMarkHandled = () => {
    onMarkHandled?.(deadline);
    setIsOpen(false);
  };

  const handleSuggestedAction = (action: SuggestedAction) => {
    onActionSelect?.(action, deadline);
    setIsOpen(false);
  };

  const hasSuggestedActions = deadline.suggestedActions && deadline.suggestedActions.length > 0;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={triggerVariant}
          size={triggerSize}
          aria-label={`Acțiuni pentru termenul: ${deadline.title}`}
        >
          {triggerLabel}
          <ChevronDownIcon className="ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" role="menu">
        <DropdownMenuLabel>Acțiuni Rapide</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleCreateTask} role="menuitem" className="cursor-pointer">
          <TaskIcon className="mr-2 text-blue-600" />
          Creează sarcină
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleSendReminder} role="menuitem" className="cursor-pointer">
          <MailIcon className="mr-2 text-green-600" />
          Trimite reminder
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={handleRequestExtension}
          role="menuitem"
          className="cursor-pointer"
        >
          <ClockIcon className="mr-2 text-orange-600" />
          Solicită prelungire
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleMarkHandled} role="menuitem" className="cursor-pointer">
          <CheckIcon className="mr-2 text-gray-600" />
          Marchează ca rezolvat
        </DropdownMenuItem>

        {/* AI-suggested actions */}
        {hasSuggestedActions && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-1">
              <span className="text-purple-600">✨</span>
              Sugestii AI
            </DropdownMenuLabel>
            {deadline.suggestedActions.map((action, index) => {
              const Icon = actionTypeIcons[action.actionType] || TaskIcon;
              return (
                <DropdownMenuItem
                  key={index}
                  onClick={() => handleSuggestedAction(action)}
                  role="menuitem"
                  className="cursor-pointer"
                >
                  <Icon className="mr-2 text-purple-600" />
                  <div className="flex flex-col">
                    <span className="text-sm">{action.action}</span>
                    {action.description && (
                      <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {action.description}
                      </span>
                    )}
                  </div>
                </DropdownMenuItem>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

DeadlineActionMenu.displayName = 'DeadlineActionMenu';

/**
 * Inline action buttons (alternative to dropdown)
 */
export interface DeadlineActionButtonsProps {
  deadline: DeadlineInfo;
  onCreateTask?: (deadline: DeadlineInfo) => void;
  onSendReminder?: (deadline: DeadlineInfo) => void;
  onMarkHandled?: (deadline: DeadlineInfo) => void;
  compact?: boolean;
}

export function DeadlineActionButtons({
  deadline,
  onCreateTask,
  onSendReminder,
  onMarkHandled,
  compact = false,
}: DeadlineActionButtonsProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-1" role="group" aria-label="Acțiuni deadline">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2"
          onClick={() => onCreateTask?.(deadline)}
          aria-label="Creează sarcină"
        >
          <TaskIcon />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2"
          onClick={() => onSendReminder?.(deadline)}
          aria-label="Trimite reminder"
        >
          <MailIcon />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2"
          onClick={() => onMarkHandled?.(deadline)}
          aria-label="Marchează rezolvat"
        >
          <CheckIcon />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Acțiuni deadline">
      <Button size="sm" variant="outline" onClick={() => onCreateTask?.(deadline)}>
        <TaskIcon className="mr-1" />
        Sarcină
      </Button>
      <Button size="sm" variant="outline" onClick={() => onSendReminder?.(deadline)}>
        <MailIcon className="mr-1" />
        Reminder
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onMarkHandled?.(deadline)}>
        <CheckIcon className="mr-1" />
        Rezolvat
      </Button>
    </div>
  );
}

DeadlineActionButtons.displayName = 'DeadlineActionButtons';
