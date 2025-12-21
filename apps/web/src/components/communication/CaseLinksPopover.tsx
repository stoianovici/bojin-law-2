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
            'bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
            className
          )}
          aria-label={`Email în ${caseLinks.length} dosare`}
        >
          <Link2 className="h-3 w-3" />+{additionalCasesCount}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-3"
          sideOffset={5}
          align="start"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h4 className="text-sm font-medium text-gray-900">Dosare asociate</h4>
              <Popover.Close asChild>
                <button
                  className="p-1 rounded hover:bg-gray-100 transition-colors"
                  aria-label="Închide"
                >
                  <X className="h-4 w-4 text-gray-400" />
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
                      isCurrentCase ? 'bg-blue-50' : 'hover:bg-gray-50'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/cases/${link.caseId}`}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate block"
                        onClick={() => setIsOpen(false)}
                      >
                        {link.case.title}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">{link.case.caseNumber}</span>
                        {link.isPrimary && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                            Principal
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Link
                        href={`/cases/${link.caseId}`}
                        className="p-1 rounded hover:bg-gray-200 transition-colors"
                        aria-label={`Deschide ${link.case.title}`}
                        onClick={() => setIsOpen(false)}
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                      </Link>

                      {!link.isPrimary && (
                        <button
                          onClick={() => handleUnlink(link.caseId)}
                          disabled={isUnlinking || unlinking}
                          className={clsx(
                            'p-1 rounded transition-colors',
                            'hover:bg-red-100 text-gray-400 hover:text-red-600',
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

          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

CaseLinksPopover.displayName = 'CaseLinksPopover';

export default CaseLinksPopover;
