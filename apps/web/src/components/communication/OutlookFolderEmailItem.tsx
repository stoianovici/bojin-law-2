'use client';

/**
 * OutlookFolderEmailItem Component
 * OPS-290: Design Folder Email Display (Card View)
 *
 * Simple card-style display for Outlook folder emails.
 * These are NOT case-assigned emails, so no AI cleaning or ConversationView bubbles.
 * Shows raw content with sender-first display pattern.
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import { MoreVertical, Paperclip, FolderPlus } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface FolderEmailData {
  id: string;
  subject: string | null;
  from: {
    name: string | null;
    address: string;
  };
  receivedDateTime: string;
  bodyPreview: string | null;
  hasAttachments: boolean;
  isRead: boolean;
}

interface OutlookFolderEmailItemProps {
  email: FolderEmailData;
  isSelected: boolean;
  onClick: () => void;
  onAssignToCase?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function OutlookFolderEmailItem({
  email,
  isSelected,
  onClick,
  onAssignToCase,
}: OutlookFolderEmailItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  const formattedDate = new Date(email.receivedDateTime).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
  });

  // OPS-189: Sender-first display pattern
  const senderName = email.from.name || email.from.address.split('@')[0];
  const senderEmail = email.from.address;
  const hasName = Boolean(email.from.name);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleAssignClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onAssignToCase?.();
  };

  // Close menu when clicking outside
  const handleBlur = () => {
    setTimeout(() => setShowMenu(false), 150);
  };

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={clsx(
          'w-full px-3 py-2.5 text-left transition-colors border-b border-linear-border-subtle',
          isSelected
            ? 'bg-linear-accent/10 border-l-2 border-linear-accent'
            : 'hover:bg-linear-bg-tertiary border-l-2 border-transparent'
        )}
      >
        {/* Sender name - prominent */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {!email.isRead && <span className="w-2 h-2 bg-linear-accent rounded-full flex-shrink-0" />}
            <p
              className={clsx(
                'text-sm truncate',
                email.isRead ? 'text-linear-text-secondary' : 'font-semibold text-linear-text-primary'
              )}
            >
              {senderName}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {email.hasAttachments && <Paperclip className="h-3 w-3 text-linear-text-muted" />}
            <span className="text-xs text-linear-text-muted">{formattedDate}</span>
          </div>
        </div>

        {/* Email address - only if we have a name */}
        {hasName && <p className="text-xs text-linear-text-tertiary truncate mt-0.5 ml-4">{senderEmail}</p>}

        {/* Subject - smaller, quoted style */}
        <p className="text-xs text-linear-text-tertiary italic truncate mt-1">
          &ldquo;{email.subject || 'Fără subiect'}&rdquo;
        </p>

        {/* Body preview - raw content, no AI cleaning */}
        {email.bodyPreview && (
          <p className="text-xs text-linear-text-muted truncate mt-1 line-clamp-2">{email.bodyPreview}</p>
        )}
      </button>

      {/* Kebab menu button - visible on hover */}
      {onAssignToCase && (
        <button
          onClick={handleMenuClick}
          onBlur={handleBlur}
          className={clsx(
            'absolute right-2 top-2 p-1 rounded hover:bg-linear-bg-hover transition-opacity',
            showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
          aria-label="Opțiuni"
        >
          <MoreVertical className="h-4 w-4 text-linear-text-tertiary" />
        </button>
      )}

      {/* Dropdown menu */}
      {showMenu && (
        <div className="absolute right-2 top-8 z-20 bg-linear-bg-secondary border border-linear-border-subtle rounded-md shadow-lg py-1 min-w-[160px]">
          <button
            onClick={handleAssignClick}
            className="w-full px-3 py-2 text-left text-sm text-linear-text-secondary hover:bg-linear-bg-tertiary flex items-center gap-2"
          >
            <FolderPlus className="h-4 w-4" />
            Atribuie la dosar
          </button>
        </div>
      )}
    </div>
  );
}

OutlookFolderEmailItem.displayName = 'OutlookFolderEmailItem';

export default OutlookFolderEmailItem;
