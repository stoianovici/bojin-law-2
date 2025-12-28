/**
 * CaseLinksPopover Component
 * OPS-062: UI Multi-Case Email Display
 *
 * Shows a popover with all cases an email is linked to.
 * Allows unlinking from non-primary cases and shows primary badge.
 */

'use client';

import React, { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { X, Link2, ExternalLink, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';
import { useEmailCaseLinks, type EmailCaseLink } from '../../hooks/useEmailSync';

// ============================================================================
// Types
// ============================================================================

export interface CaseLinksPopoverProps {
  /** The email ID for unlink operations */
  emailId: string;
  /** All case links for this email */
  caseLinks: EmailCaseLink[];
  /** The ID of the current case context (optional, to highlight it) */
  currentCaseId?: string;
  /** Callback when a case is unlinked */
  onUnlink?: (caseId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function CaseLinksPopover({
  emailId,
  caseLinks,
  currentCaseId,
  onUnlink,
  className,
}: CaseLinksPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unlinkingCaseId, setUnlinkingCaseId] = useState<string | null>(null);
  const { unlinkEmailFromCase, unlinking } = useEmailCaseLinks();

  // Don't render if no additional cases
  if (caseLinks.length <= 1) {
    return null;
  }

  const additionalCasesCount = caseLinks.length - 1;

  const handleUnlink = async (caseId: string) => {
    setUnlinkingCaseId(caseId);
    try {
      const success = await unlinkEmailFromCase(emailId, caseId);
      if (success) {
        onUnlink?.(caseId);
      }
    } finally {
      setUnlinkingCaseId(null);
    }
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          className={clsx(
            'inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium',
            'bg-linear-accent/15 text-linear-accent rounded hover:bg-linear-accent/25 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-offset-1',
            className
          )}
          aria-label={`Email în ${caseLinks.length} dosare`}
        >
          <Link2 className="h-3 w-3" />+{additionalCasesCount}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 w-72 bg-linear-bg-secondary rounded-lg shadow-lg border border-linear-border-subtle p-3"
          sideOffset={5}
          align="start"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-linear-border-subtle/50">
              <h4 className="text-sm font-medium text-linear-text-primary">Dosare asociate</h4>
              <Popover.Close asChild>
                <button
                  className="p-1 rounded hover:bg-linear-bg-hover transition-colors"
                  aria-label="Închide"
                >
                  <X className="h-4 w-4 text-linear-text-muted" />
                </button>
              </Popover.Close>
            </div>

            <ul className="space-y-1.5" role="list">
              {caseLinks.map((link) => {
                const isCurrentCase = link.caseId === currentCaseId;
                const isUnlinking = unlinkingCaseId === link.caseId;

                return (
                  <li
                    key={link.id}
                    className={clsx(
                      'flex items-center justify-between gap-2 p-2 rounded',
                      isCurrentCase ? 'bg-linear-accent/10' : 'hover:bg-linear-bg-hover'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/cases/${link.caseId}`}
                        className="text-sm font-medium text-linear-text-primary hover:text-linear-accent truncate block"
                        onClick={() => setIsOpen(false)}
                      >
                        {link.case.title}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-linear-text-tertiary">{link.case.caseNumber}</span>
                        {link.isPrimary && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-linear-success/15 text-linear-success rounded">
                            Principal
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Link
                        href={`/cases/${link.caseId}`}
                        className="p-1 rounded hover:bg-linear-bg-hover transition-colors"
                        aria-label={`Deschide ${link.case.title}`}
                        onClick={() => setIsOpen(false)}
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-linear-text-muted" />
                      </Link>

                      {!link.isPrimary && (
                        <button
                          onClick={() => handleUnlink(link.caseId)}
                          disabled={isUnlinking || unlinking}
                          className={clsx(
                            'p-1 rounded transition-colors',
                            'hover:bg-linear-error/15 text-linear-text-muted hover:text-linear-error',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                          )}
                          aria-label={`Elimină din ${link.case.title}`}
                          title="Elimină din dosar"
                        >
                          {isUnlinking ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <Popover.Arrow className="fill-linear-bg-secondary" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

CaseLinksPopover.displayName = 'CaseLinksPopover';

export default CaseLinksPopover;
