'use client';

/**
 * OutlookFoldersSection Component
 * OPS-290: Design Folder Email Display (Card View)
 * OPS-293: Add Outlook Folders Section to CaseSidebar
 *
 * Displays Outlook folders with unassigned emails in the sidebar.
 * Folders are expandable to show email lists.
 *
 * Position: Between DOSARE and INSTANȚE sections
 */

import { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, ChevronDown, ChevronRight, Mail } from 'lucide-react';
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

export interface OutlookFolder {
  id: string;
  name: string;
  emailCount: number;
  unreadCount: number;
  emails: FolderEmailData[];
}

interface OutlookFoldersSectionProps {
  folders: OutlookFolder[];
  selectedEmailId: string | null;
  onSelectEmail: (emailId: string, folderId: string) => void;
  onAssignToCase?: (emailId: string) => void;
  /** Section collapsed state from parent */
  isCollapsed?: boolean;
  /** Toggle section collapse */
  onToggleSection?: () => void;
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

function SectionHeader({
  isCollapsed,
  totalCount,
  totalUnread,
  onClick,
}: {
  isCollapsed: boolean;
  totalCount: number;
  totalUnread: number;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full px-3 py-2 bg-linear-bg-tertiary border-b border-linear-border-subtle sticky top-0 z-10"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-linear-text-secondary">
          <FolderOpen className="h-4 w-4 text-linear-text-tertiary" />
          FOLDERE OUTLOOK
        </div>
        <div className="flex items-center gap-2">
          {totalUnread > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-linear-accent/15 text-linear-accent rounded-full">
              {totalUnread}
            </span>
          )}
          {totalCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-linear-bg-hover text-linear-text-tertiary rounded-full">
              {totalCount}
            </span>
          )}
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-linear-text-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-linear-text-muted" />
          )}
        </div>
      </div>
    </button>
  );
}

function FolderAccordionItem({
  folder,
  isExpanded,
  onToggle,
  selectedEmailId,
  onSelectEmail,
  onAssignToCase,
}: {
  folder: OutlookFolder;
  isExpanded: boolean;
  onToggle: () => void;
  selectedEmailId: string | null;
  onSelectEmail: (emailId: string) => void;
  onAssignToCase?: (emailId: string) => void;
}) {
  return (
    <div className="border-b border-linear-border-subtle">
      {/* Folder Header */}
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 text-left flex items-center justify-between hover:bg-linear-bg-tertiary transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-linear-text-muted flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-linear-text-muted flex-shrink-0" />
          )}
          <Mail className="h-4 w-4 text-linear-accent flex-shrink-0" />
          <span className="font-medium text-sm text-linear-text-primary truncate">{folder.name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {folder.unreadCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-linear-accent/15 text-linear-accent rounded">
              {folder.unreadCount}
            </span>
          )}
          <span className="text-xs text-linear-text-muted">({folder.emailCount})</span>
        </div>
      </button>

      {/* Email List (when expanded) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="bg-linear-bg-tertiary/50"
            variants={listContainerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            {folder.emails.length === 0 ? (
              <div className="px-3 py-4 text-xs text-linear-text-tertiary text-center italic">
                Folderul este gol
              </div>
            ) : (
              folder.emails.map((email) => (
                <motion.div key={email.id} variants={listItemVariants}>
                  <OutlookFolderEmailItem
                    email={email}
                    isSelected={selectedEmailId === email.id}
                    onClick={() => onSelectEmail(email.id)}
                    onAssignToCase={onAssignToCase ? () => onAssignToCase(email.id) : undefined}
                  />
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function OutlookFoldersSection({
  folders,
  selectedEmailId,
  onSelectEmail,
  onAssignToCase,
  isCollapsed = false,
  onToggleSection,
  className,
}: OutlookFoldersSectionProps) {
  // Track which folders are expanded
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    // Expand folders with unread emails by default
    const initialExpanded = new Set<string>();
    folders.forEach((f) => {
      if (f.unreadCount > 0) {
        initialExpanded.add(f.id);
      }
    });
    return initialExpanded;
  });

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  // Calculate totals
  const totalCount = folders.reduce((sum, f) => sum + f.emailCount, 0);
  const totalUnread = folders.reduce((sum, f) => sum + f.unreadCount, 0);

  // Don't render if no folders
  if (folders.length === 0) {
    return null;
  }

  return (
    <div className={clsx('', className)}>
      <SectionHeader
        isCollapsed={isCollapsed}
        totalCount={totalCount}
        totalUnread={totalUnread}
        onClick={onToggleSection}
      />

      {!isCollapsed && (
        <>
          {folders.map((folder) => (
            <FolderAccordionItem
              key={folder.id}
              folder={folder}
              isExpanded={expandedFolders.has(folder.id)}
              onToggle={() => toggleFolder(folder.id)}
              selectedEmailId={selectedEmailId}
              onSelectEmail={(emailId) => onSelectEmail(emailId, folder.id)}
              onAssignToCase={onAssignToCase}
            />
          ))}
        </>
      )}
    </div>
  );
}

OutlookFoldersSection.displayName = 'OutlookFoldersSection';

export default OutlookFoldersSection;
