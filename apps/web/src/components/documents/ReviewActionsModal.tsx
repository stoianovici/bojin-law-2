/**
 * ReviewActionsModal Component
 * OPS-177: Review Workflow Actions
 *
 * Modal for supervisors to approve documents or request changes.
 * When requesting changes, allows choosing between:
 * 1. Send back to original sender
 * 2. Assign to someone else in the firm
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, MessageSquare, Loader2, FileCheck, UserCheck, Users } from 'lucide-react';
import { useNotificationStore } from '@/stores/notificationStore';
import { useSupervisors, type Supervisor } from '@/hooks/useSupervisors';
import { ReviewEmailPreviewModal } from './ReviewEmailPreviewModal';
import clsx from 'clsx';

// ============================================================================
// Types
// ============================================================================

export interface ReviewDocument {
  id: string;
  fileName: string;
  metadata?: {
    reviewSubmissionMessage?: string;
    submittedBy?: string;
    submittedByName?: string;
    submittedByEmail?: string;
  };
}

export interface ReviewActionsModalProps {
  document: ReviewDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ReviewDecision = 'APPROVE' | 'REQUEST_CHANGES' | null;
type ChangesTarget = 'sender' | 'other' | null;

// ============================================================================
// GraphQL Mutation
// ============================================================================

interface ReviewDocumentResult {
  reviewDocument: {
    success: boolean;
    error: string | null;
    document: {
      id: string;
      status: string;
      reviewerId: string | null;
    } | null;
  };
}

const REVIEW_DOCUMENT = gql`
  mutation ReviewDocument($input: ReviewDecisionInput!) {
    reviewDocument(input: $input) {
      success
      error
      document {
        id
        status
        reviewerId
        metadata
      }
    }
  }
`;

// ============================================================================
// Component
// ============================================================================

export function ReviewActionsModal({
  document,
  open,
  onOpenChange,
  onSuccess,
}: ReviewActionsModalProps) {
  const [decision, setDecision] = useState<ReviewDecision>(null);
  const [changesTarget, setChangesTarget] = useState<ChangesTarget>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [comment, setComment] = useState('');
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  const [reviewDocument, { loading: submitting }] =
    useMutation<ReviewDocumentResult>(REVIEW_DOCUMENT);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const { supervisors, loading: loadingSupervisors } = useSupervisors();

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setDecision(null);
      setChangesTarget(null);
      setAssigneeId('');
      setComment('');
      setShowEmailPreview(false);
    }
  }, [open]);

  // Reset target when decision changes
  useEffect(() => {
    if (decision !== 'REQUEST_CHANGES') {
      setChangesTarget(null);
      setAssigneeId('');
    }
  }, [decision]);

  const handleReview = async () => {
    if (!decision) {
      addNotification({
        type: 'error',
        title: 'Selectați o decizie',
      });
      return;
    }

    if (decision === 'REQUEST_CHANGES') {
      if (!changesTarget) {
        addNotification({
          type: 'error',
          title: 'Selectați cui trimiteți documentul',
        });
        return;
      }
      if (changesTarget === 'other' && !assigneeId) {
        addNotification({
          type: 'error',
          title: 'Selectați persoana care va face modificările',
        });
        return;
      }
      if (!comment.trim()) {
        addNotification({
          type: 'error',
          title: 'Comentariul este obligatoriu când solicitați modificări',
        });
        return;
      }
    }

    try {
      const result = await reviewDocument({
        variables: {
          input: {
            documentId: document.id,
            decision,
            comment: comment.trim() || null,
            // Include assignee if sending to someone other than sender
            ...(changesTarget === 'other' && assigneeId ? { assignToUserId: assigneeId } : {}),
          },
        },
      });

      if (result.data?.reviewDocument.success) {
        const targetName =
          changesTarget === 'sender'
            ? 'expeditorului'
            : supervisors.find((s) => s.id === assigneeId)?.name || 'persoanei selectate';

        addNotification({
          type: 'success',
          title:
            decision === 'APPROVE' ? 'Document aprobat' : `Modificări solicitate ${targetName}`,
        });

        // If requesting changes from sender, show email preview instead of closing
        if (decision === 'REQUEST_CHANGES' && changesTarget === 'sender') {
          setShowEmailPreview(true);
        } else {
          onOpenChange(false);
          onSuccess?.();
        }
      } else {
        addNotification({
          type: 'error',
          title: result.data?.reviewDocument.error || 'Eroare la procesarea revizuirii',
        });
      }
    } catch (error) {
      console.error('Error reviewing document:', error);
      addNotification({
        type: 'error',
        title: 'Eroare la procesarea revizuirii',
      });
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onOpenChange(false);
    }
  };

  const isValid =
    decision === 'APPROVE' ||
    (decision === 'REQUEST_CHANGES' &&
      changesTarget &&
      (changesTarget === 'sender' || assigneeId) &&
      comment.trim());

  // Get sender info for display and email
  const senderName = document.metadata?.submittedByName || 'expeditor';
  const senderEmail =
    document.metadata?.submittedByEmail || document.metadata?.submittedByName || '';

  // Handler for when email flow completes (sent or skipped)
  const handleEmailComplete = () => {
    setShowEmailPreview(false);
    onOpenChange(false);
    onSuccess?.();
  };

  // If showing email preview, render that instead of the main modal
  if (showEmailPreview && senderEmail) {
    return (
      <ReviewEmailPreviewModal
        documentId={document.id}
        documentName={document.fileName}
        recipientEmail={senderEmail}
        recipientName={senderName}
        feedback={comment}
        open={true}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            handleEmailComplete();
          }
        }}
        onSent={handleEmailComplete}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Revizuire document
          </DialogTitle>
          <DialogDescription>{document.fileName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Submission info (if there's a message from submitter) */}
          {document.metadata?.reviewSubmissionMessage && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm font-medium text-blue-800">Mesaj de la {senderName}:</p>
              <p className="mt-1 text-sm text-blue-700">
                &quot;{document.metadata.reviewSubmissionMessage}&quot;
              </p>
            </div>
          )}

          {/* Decision buttons */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Decizie</span>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={decision === 'APPROVE' ? 'default' : 'outline'}
                className={clsx(
                  'flex-1',
                  decision === 'APPROVE' && 'bg-green-600 hover:bg-green-700'
                )}
                onClick={() => setDecision('APPROVE')}
                disabled={submitting}
              >
                <Check className="mr-2 h-4 w-4" />
                Aprobă
              </Button>
              <Button
                type="button"
                variant={decision === 'REQUEST_CHANGES' ? 'destructive' : 'outline'}
                className="flex-1"
                onClick={() => setDecision('REQUEST_CHANGES')}
                disabled={submitting}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Solicită modificări
              </Button>
            </div>
          </div>

          {/* Changes target selection - only show when REQUEST_CHANGES is selected */}
          {decision === 'REQUEST_CHANGES' && (
            <div className="space-y-3">
              <span className="text-sm font-medium text-gray-700">Cine face modificările?</span>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={changesTarget === 'sender' ? 'default' : 'outline'}
                  className={clsx(
                    'flex-1',
                    changesTarget === 'sender' && 'bg-blue-600 hover:bg-blue-700'
                  )}
                  onClick={() => setChangesTarget('sender')}
                  disabled={submitting}
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  <span className="truncate">Expeditorul ({senderName})</span>
                </Button>
                <Button
                  type="button"
                  variant={changesTarget === 'other' ? 'default' : 'outline'}
                  className={clsx(
                    'flex-1',
                    changesTarget === 'other' && 'bg-blue-600 hover:bg-blue-700'
                  )}
                  onClick={() => setChangesTarget('other')}
                  disabled={submitting}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Altcineva din firmă
                </Button>
              </div>

              {/* Assignee picker - only show when "other" is selected */}
              {changesTarget === 'other' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Selectează persoana *</label>
                  <Select
                    value={assigneeId}
                    onValueChange={setAssigneeId}
                    disabled={loadingSupervisors || submitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectează persoana" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingSupervisors ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : supervisors.length === 0 ? (
                        <div className="py-4 text-center text-sm text-gray-500">
                          Nu există persoane disponibile
                        </div>
                      ) : (
                        supervisors.map((person: Supervisor) => (
                          <SelectItem key={person.id} value={person.id}>
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                                {person.initials}
                              </div>
                              <div className="flex flex-col">
                                <span>{person.name}</span>
                                <span className="text-xs text-gray-500">
                                  {person.role === 'Partner' ? 'Partener' : 'Asociat'}
                                </span>
                              </div>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Comment field */}
          {decision && (
            <div className="space-y-2">
              <label htmlFor="comment" className="text-sm font-medium text-gray-700">
                Comentariu{decision === 'REQUEST_CHANGES' ? ' *' : ' (opțional)'}
              </label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  decision === 'REQUEST_CHANGES'
                    ? 'Descrieți modificările necesare...'
                    : 'Adăugați un comentariu opțional...'
                }
                rows={4}
                disabled={submitting}
                className="bg-white"
              />
              {decision === 'REQUEST_CHANGES' && !comment.trim() && changesTarget && (
                <p className="text-xs text-red-500">
                  Comentariul este obligatoriu când solicitați modificări
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Anulează
          </Button>
          <Button
            onClick={handleReview}
            disabled={!isValid || submitting}
            className={clsx(
              decision === 'APPROVE' && 'bg-green-600 hover:bg-green-700',
              decision === 'REQUEST_CHANGES' && 'bg-orange-600 hover:bg-orange-700'
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Se procesează...
              </>
            ) : (
              'Confirmă'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
