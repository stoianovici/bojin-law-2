'use client';

/**
 * FolderEmailsPanel Component
 * OPS-290: Design Folder Email Display (Card View)
 *
 * Panel for displaying emails from a specific Outlook folder.
 * Simple card/list view - NOT ConversationView bubbles.
 * Shows raw content without AI processing.
 */

import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Inbox, ArrowLeft } from 'lucide-react';
import { OutlookFolderEmailItem, type FolderEmailData } from './OutlookFolderEmailItem';

// ============================================================================
// Animation Variants
// ============================================================================

const listItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
};

const listContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
};

// ============================================================================
// Types
// ============================================================================

export interface OutlookFolderData {
  id: string;
  name: string;
  emailCount: number;
  unreadCount: number;
}

interface FolderEmailsPanelProps {
  folder: OutlookFolderData;
  emails: FolderEmailData[];
  selectedEmailId: string | null;
  onSelectEmail: (emailId: string) => void;
  onAssignToCase?: (emailId: string) => void;
  onBack?: () => void;
  /** Loading state */
  loading?: boolean;
  /** Has more emails to load */
  hasMore?: boolean;
  /** Load more callback */
  onLoadMore?: () => void;
  /** Loading more state */
  loadingMore?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function FolderEmailsPanel({
  folder,
  emails,
  selectedEmailId,
  onSelectEmail,
  onAssignToCase,
  onBack,
  loading = false,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  className,
}: FolderEmailsPanelProps) {
  const isEmpty = emails.length === 0 && !loading;

  return (
    <div className={clsx('flex flex-col h-full bg-linear-bg-secondary', className)}>
      {/* Header */}
      <div className="px-3 py-2 bg-linear-bg-tertiary border-b border-linear-border-subtle sticky top-0 z-10">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1 rounded hover:bg-linear-bg-hover transition-colors"
              aria-label="Înapoi"
            >
              <ArrowLeft className="h-4 w-4 text-linear-text-tertiary" />
            </button>
          )}
          <div className="flex items-center justify-between flex-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-linear-text-secondary">
              <Inbox className="h-4 w-4 text-linear-text-tertiary" />
              {folder.name}
            </div>
            <div className="flex items-center gap-2">
              {folder.unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-linear-accent/15 text-linear-accent rounded-full">
                  {folder.unreadCount} necitite
                </span>
              )}
              <span className="text-xs text-linear-text-muted">({folder.emailCount})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          // Loading skeleton
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center justify-between gap-2">
                  <div className="h-4 bg-linear-bg-tertiary rounded w-32" />
                  <div className="h-3 bg-linear-bg-tertiary rounded w-16" />
                </div>
                <div className="h-3 bg-linear-bg-tertiary rounded w-48 mt-2" />
                <div className="h-3 bg-linear-bg-tertiary rounded w-full mt-1" />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full py-12 px-4">
            <Mail className="h-12 w-12 text-linear-text-muted mb-3" />
            <p className="text-sm text-linear-text-tertiary text-center">Folderul este gol</p>
            <p className="text-xs text-linear-text-muted text-center mt-1">
              Nu există emailuri neatribuite în acest folder
            </p>
          </div>
        ) : (
          // Email list with animations
          <AnimatePresence>
            <motion.div
              variants={listContainerVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              {emails.map((email) => (
                <motion.div key={email.id} variants={listItemVariants}>
                  <OutlookFolderEmailItem
                    email={email}
                    isSelected={selectedEmailId === email.id}
                    onClick={() => onSelectEmail(email.id)}
                    onAssignToCase={onAssignToCase ? () => onAssignToCase(email.id) : undefined}
                  />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Load more button */}
        {hasMore && onLoadMore && !loading && (
          <div className="p-3 border-t border-linear-border-subtle">
            <button
              onClick={onLoadMore}
              disabled={loadingMore}
              className="w-full py-2 text-sm text-linear-accent hover:text-linear-accent-hover hover:bg-linear-accent/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMore ? 'Se încarcă...' : 'Încarcă mai multe emailuri'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

FolderEmailsPanel.displayName = 'FolderEmailsPanel';

export default FolderEmailsPanel;
