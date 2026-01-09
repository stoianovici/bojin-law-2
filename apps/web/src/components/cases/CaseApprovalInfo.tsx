'use client';

import * as React from 'react';
import { User, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type CaseApproval } from '@/hooks/useCaseApproval';

interface CaseApprovalInfoProps {
  approval: CaseApproval;
  className?: string;
}

export function CaseApprovalInfo({ approval, className }: CaseApprovalInfoProps) {
  const submitterName = `${approval.submittedBy.firstName} ${approval.submittedBy.lastName}`;
  const submittedDate = new Date(approval.submittedAt).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isRejected = approval.status === 'Rejected';

  return (
    <div className={cn('space-y-3', className)}>
      {/* Submission info */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <div className="flex items-center gap-2 text-sm text-amber-600">
          <User className="w-4 h-4" />
          <span>Trimis de {submitterName}</span>
        </div>
        <span className="text-amber-500/50">•</span>
        <div className="flex items-center gap-1.5 text-sm text-amber-600">
          <Clock className="w-3.5 h-3.5" />
          <span>{submittedDate}</span>
        </div>
        {approval.revisionCount > 0 && (
          <>
            <span className="text-amber-500/50">•</span>
            <span className="text-xs text-amber-600/80">Revizia #{approval.revisionCount + 1}</span>
          </>
        )}
      </div>

      {/* Rejection reason (if rejected) */}
      {isRejected && approval.rejectionReason && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-600 mb-1">
              Respins de {approval.reviewedBy?.firstName} {approval.reviewedBy?.lastName}
            </p>
            <p className="text-sm text-red-600/80">{approval.rejectionReason}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default CaseApprovalInfo;
