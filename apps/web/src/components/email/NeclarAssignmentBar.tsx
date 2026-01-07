'use client';

import { useState } from 'react';
import { Folder, Ban, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { SplitAssignmentButton } from './SplitAssignmentButton';
import type { UncertainEmail, CaseSuggestion } from '@/types/email';

interface NeclarAssignmentBarProps {
  email: UncertainEmail;
  onAssignToCase: (caseId: string) => Promise<void>;
  onIgnore: () => Promise<void>;
  onMarkAsPersonal: () => Promise<void>;
  onChooseOtherCase: () => void;
  loading?: boolean;
  className?: string;
}

export function NeclarAssignmentBar({
  email,
  onAssignToCase,
  onIgnore,
  onMarkAsPersonal,
  onChooseOtherCase,
  loading = false,
  className,
}: NeclarAssignmentBarProps) {
  const [actionLoading, setActionLoading] = useState<'ignore' | 'personal' | null>(null);

  const primaryCase = email.suggestedCases[0] || null;
  const secondaryCase = email.suggestedCases[1] || null;

  const handleIgnore = async () => {
    setActionLoading('ignore');
    try {
      await onIgnore();
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAsPersonal = async () => {
    setActionLoading('personal');
    try {
      await onMarkAsPersonal();
    } finally {
      setActionLoading(null);
    }
  };

  const isLoading = loading || actionLoading !== null;

  return (
    <div
      className={cn(
        'px-5 py-4 bg-linear-bg-tertiary border-b border-linear-border-subtle',
        className
      )}
    >
      {/* Label */}
      <div className="text-sm text-linear-text-secondary mb-3">
        Atribuie acest email unui dosar:
      </div>

      {/* Split Assignment Button */}
      {primaryCase ? (
        <SplitAssignmentButton
          primaryCase={primaryCase}
          secondaryCase={secondaryCase}
          allSuggestions={email.suggestedCases}
          onAssign={onAssignToCase}
          loading={loading}
          disabled={isLoading}
          className="mb-3"
        />
      ) : (
        <div className="text-sm text-linear-text-tertiary mb-3 py-2">
          Nu există sugestii de dosare pentru acest email.
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Choose Other Case */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onChooseOtherCase}
          disabled={isLoading}
          className="h-8 text-xs"
        >
          <Folder className="h-3.5 w-3.5 mr-1.5" />
          Alege alt dosar...
        </Button>

        {/* Ignore */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleIgnore}
          disabled={isLoading}
          className="h-8 text-xs text-linear-error hover:text-linear-error hover:bg-linear-error/10"
        >
          {actionLoading === 'ignore' ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Ban className="h-3.5 w-3.5 mr-1.5" />
          )}
          Ignoră
        </Button>

        {/* Mark as Personal */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleMarkAsPersonal}
          disabled={isLoading}
          className="h-8 text-xs"
        >
          {actionLoading === 'personal' ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <User className="h-3.5 w-3.5 mr-1.5" />
          )}
          Contact personal
        </Button>
      </div>
    </div>
  );
}
