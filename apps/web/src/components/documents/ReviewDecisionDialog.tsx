'use client';

/**
 * Review Decision Dialog
 * Story 3.6: Document Review and Approval Workflow
 *
 * Dialog for making approval/rejection/revision decisions on document reviews
 */

import * as React from 'react';
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface ReviewDecisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentName: string;
  hasUnresolvedComments: boolean;
  hasUnaddressedConcerns: boolean;
  onDecision: (data: {
    decision: 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';
    feedback: string;
  }) => Promise<void>;
}

type Decision = 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';

const decisionOptions: Array<{
  value: Decision;
  label: string;
  description: string;
  icon: typeof CheckCircle;
  color: string;
  bgColor: string;
}> = [
  {
    value: 'APPROVED',
    label: 'Approve',
    description: 'Document meets requirements and is ready for use',
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
  },
  {
    value: 'REVISION_REQUESTED',
    label: 'Request Revision',
    description: 'Document needs changes before approval',
    icon: RotateCcw,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-200',
  },
  {
    value: 'REJECTED',
    label: 'Reject',
    description: 'Document does not meet requirements',
    icon: XCircle,
    color: 'text-destructive',
    bgColor: 'bg-red-50 border-red-200',
  },
];

export function ReviewDecisionDialog({
  open,
  onOpenChange,
  documentName,
  hasUnresolvedComments,
  hasUnaddressedConcerns,
  onDecision,
}: ReviewDecisionDialogProps) {
  const [selectedDecision, setSelectedDecision] = React.useState<Decision | null>(null);
  const [feedback, setFeedback] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    if (!selectedDecision || !feedback.trim()) return;

    setIsSubmitting(true);
    try {
      await onDecision({
        decision: selectedDecision,
        feedback,
      });
      onOpenChange(false);
      setSelectedDecision(null);
      setFeedback('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canApprove = !hasUnresolvedComments && !hasUnaddressedConcerns;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Review Decision</DialogTitle>
          <DialogDescription>
            Make a decision on &quot;{documentName}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warnings */}
          {(hasUnresolvedComments || hasUnaddressedConcerns) && (
            <div className="space-y-2">
              {hasUnresolvedComments && (
                <div className="flex items-center gap-2 text-sm p-2 rounded bg-yellow-50 border border-yellow-200 text-yellow-800">
                  <AlertTriangle className="h-4 w-4" />
                  There are unresolved comments on this document
                </div>
              )}
              {hasUnaddressedConcerns && (
                <div className="flex items-center gap-2 text-sm p-2 rounded bg-orange-50 border border-orange-200 text-orange-800">
                  <AlertTriangle className="h-4 w-4" />
                  AI-flagged concerns have not been addressed
                </div>
              )}
            </div>
          )}

          {/* Decision Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Decision</label>
            <div className="grid gap-2">
              {decisionOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedDecision === option.value;
                const isDisabled =
                  option.value === 'APPROVED' && !canApprove;

                return (
                  <button
                    key={option.value}
                    onClick={() => !isDisabled && setSelectedDecision(option.value)}
                    disabled={isDisabled}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                      isSelected
                        ? option.bgColor
                        : 'bg-background hover:bg-muted/50'
                    } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Icon className={`h-5 w-5 mt-0.5 ${option.color}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{option.label}</span>
                        {isSelected && (
                          <Badge variant="secondary" className="text-xs">
                            Selected
                          </Badge>
                        )}
                        {isDisabled && (
                          <Badge variant="outline" className="text-xs">
                            Resolve issues first
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feedback */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Feedback{' '}
              <span className="text-muted-foreground font-normal">
                (required)
              </span>
            </label>
            <Textarea
              value={feedback}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFeedback(e.target.value)}
              placeholder={
                selectedDecision === 'APPROVED'
                  ? 'Add approval notes...'
                  : selectedDecision === 'REJECTED'
                  ? 'Explain why the document is rejected...'
                  : selectedDecision === 'REVISION_REQUESTED'
                  ? 'Describe what changes are needed...'
                  : 'Select a decision to add feedback...'
              }
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedDecision || !feedback.trim() || isSubmitting}
            variant={
              selectedDecision === 'REJECTED'
                ? 'destructive'
                : selectedDecision === 'REVISION_REQUESTED'
                ? 'secondary'
                : 'default'
            }
          >
            {isSubmitting ? (
              'Submitting...'
            ) : (
              <>
                {selectedDecision === 'APPROVED' && (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve Document
                  </>
                )}
                {selectedDecision === 'REJECTED' && (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject Document
                  </>
                )}
                {selectedDecision === 'REVISION_REQUESTED' && (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Request Revision
                  </>
                )}
                {!selectedDecision && 'Submit Decision'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
