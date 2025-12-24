/**
 * SubmitForReviewModal Component
 * OPS-177: Review Workflow Actions
 *
 * Modal for submitting a document for supervisor review.
 * Allows selecting a reviewer and adding an optional message.
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
import { Loader2, Send } from 'lucide-react';
import { useSupervisors, type Supervisor } from '@/hooks/useSupervisors';
import { useNotificationStore } from '@/stores/notificationStore';

// ============================================================================
// Types
// ============================================================================

export interface SubmitForReviewModalProps {
  documentId: string;
  documentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ============================================================================
// GraphQL Mutation
// ============================================================================

interface SubmitForReviewResult {
  submitForReview: {
    success: boolean;
    error: string | null;
    document: {
      id: string;
      status: string;
      reviewerId: string | null;
      submittedAt: string | null;
    } | null;
  };
}

const SUBMIT_FOR_REVIEW = gql`
  mutation SubmitForReview($input: SubmitForReviewInput!) {
    submitForReview(input: $input) {
      success
      error
      document {
        id
        status
        reviewerId
        submittedAt
        reviewer {
          id
          firstName
          lastName
          email
        }
      }
    }
  }
`;

// ============================================================================
// Component
// ============================================================================

export function SubmitForReviewModal({
  documentId,
  documentName,
  open,
  onOpenChange,
  onSuccess,
}: SubmitForReviewModalProps) {
  const [reviewerId, setReviewerId] = useState('');
  const [message, setMessage] = useState('');

  const { supervisors, loading: loadingSupervisors } = useSupervisors();
  const [submitForReview, { loading: submitting }] =
    useMutation<SubmitForReviewResult>(SUBMIT_FOR_REVIEW);
  const addNotification = useNotificationStore((s) => s.addNotification);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setReviewerId('');
      setMessage('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!reviewerId) {
      addNotification({
        type: 'error',
        title: 'Selectați un supervizor',
      });
      return;
    }

    try {
      const result = await submitForReview({
        variables: {
          input: {
            documentId,
            reviewerId,
            message: message.trim() || null,
          },
        },
      });

      if (result.data?.submitForReview.success) {
        addNotification({
          type: 'success',
          title: 'Document trimis pentru revizuire',
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        addNotification({
          type: 'error',
          title: result.data?.submitForReview.error || 'Eroare la trimiterea documentului',
        });
      }
    } catch (error) {
      console.error('Error submitting for review:', error);
      addNotification({
        type: 'error',
        title: 'Eroare la trimiterea documentului',
      });
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Trimite pentru revizuire
          </DialogTitle>
          <DialogDescription>
            Selectați un supervizor care să revizuiască documentul{' '}
            <span className="font-medium">{documentName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Supervisor Picker */}
          <div className="space-y-2">
            <label htmlFor="reviewer" className="text-sm font-medium text-gray-700">
              Supervizor *
            </label>
            <Select
              value={reviewerId}
              onValueChange={setReviewerId}
              disabled={loadingSupervisors || submitting}
            >
              <SelectTrigger id="reviewer">
                <SelectValue placeholder="Selectați supervizor" />
              </SelectTrigger>
              <SelectContent>
                {loadingSupervisors ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : supervisors.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    Nu există supervizori disponibili
                  </div>
                ) : (
                  supervisors.map((supervisor: Supervisor) => (
                    <SelectItem key={supervisor.id} value={supervisor.id}>
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {supervisor.initials}
                        </div>
                        <div className="flex flex-col">
                          <span>{supervisor.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {supervisor.role === 'Partner' ? 'Partener' : 'Asociat'}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Optional Message */}
          <div className="space-y-2">
            <label htmlFor="message" className="text-sm font-medium text-gray-700">
              Mesaj (opțional)
            </label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Adăugați un mesaj pentru supervizor..."
              rows={3}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Anulează
          </Button>
          <Button onClick={handleSubmit} disabled={!reviewerId || submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Se trimite...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Trimite
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
