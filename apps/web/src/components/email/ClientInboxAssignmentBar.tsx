'use client';

import { useState } from 'react';
import { Folder, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

interface ClientActiveCase {
  id: string;
  title: string;
  caseNumber: string;
}

interface ClientInboxAssignmentBarProps {
  clientName: string;
  activeCases: ClientActiveCase[];
  onAssignToCase: (caseId: string) => Promise<void>;
  loading?: boolean;
  className?: string;
}

export function ClientInboxAssignmentBar({
  clientName,
  activeCases,
  onAssignToCase,
  loading = false,
  className,
}: ClientInboxAssignmentBarProps) {
  const [assigningCaseId, setAssigningCaseId] = useState<string | null>(null);

  const handleAssign = async (caseId: string) => {
    setAssigningCaseId(caseId);
    try {
      await onAssignToCase(caseId);
    } finally {
      setAssigningCaseId(null);
    }
  };

  const isLoading = loading || assigningCaseId !== null;

  return (
    <div
      className={cn(
        'px-5 py-4 bg-linear-bg-tertiary border-t border-linear-border-subtle',
        className
      )}
    >
      {/* Label */}
      <div className="text-sm text-linear-text-secondary mb-3">
        Atribuie acest email unui dosar al clientului{' '}
        <span className="font-medium text-linear-text-primary">{clientName}</span>:
      </div>

      {/* Case Options */}
      <div className="flex flex-wrap gap-2">
        {activeCases.map((caseItem) => {
          const isAssigning = assigningCaseId === caseItem.id;

          return (
            <Button
              key={caseItem.id}
              variant="secondary"
              size="sm"
              onClick={() => handleAssign(caseItem.id)}
              disabled={isLoading}
              className={cn('h-9 px-3 text-sm', isAssigning && 'bg-linear-accent/20')}
            >
              {isAssigning ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <Folder className="h-3.5 w-3.5 mr-2" />
              )}
              <span className="font-medium mr-1.5">{caseItem.caseNumber}</span>
              <span className="text-linear-text-secondary truncate max-w-[200px]">
                {caseItem.title}
              </span>
            </Button>
          );
        })}
      </div>

      {/* Empty state if no active cases */}
      {activeCases.length === 0 && (
        <div className="text-sm text-linear-text-tertiary py-2">
          Nu exista dosare active pentru acest client.
        </div>
      )}
    </div>
  );
}
