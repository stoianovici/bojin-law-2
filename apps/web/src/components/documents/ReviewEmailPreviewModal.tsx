/**
 * ReviewEmailPreviewModal Component
 * OPS-177: Review Workflow Actions
 *
 * Modal showing a preview of the review feedback email before sending.
 * Displayed after a supervisor requests changes on a document.
 */

'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, Save, X } from 'lucide-react';
import { useNotificationStore } from '@/stores/notificationStore';

// ============================================================================
// Types
// ============================================================================

export interface ReviewEmailPreviewModalProps {
  documentId: string;
  documentName: string;
  recipientEmail: string;
  recipientName: string;
  feedback: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}

// ============================================================================
// GraphQL
// ============================================================================

interface EmailPreview {
  subject: string;
  body: string;
  to: string;
  toName: string;
}

interface PreviewResult {
  previewReviewFeedbackEmail: EmailPreview;
}

interface SendResult {
  sendReviewFeedbackEmail: {
    success: boolean;
    error: string | null;
  };
}

const PREVIEW_EMAIL = gql`
  query PreviewReviewFeedbackEmail($input: SendReviewFeedbackEmailInput!) {
    previewReviewFeedbackEmail(input: $input) {
      subject
      body
      to
      toName
    }
  }
`;

const SEND_EMAIL = gql`
  mutation SendReviewFeedbackEmail($input: SendReviewFeedbackEmailInput!) {
    sendReviewFeedbackEmail(input: $input) {
      success
      error
    }
  }
`;

// ============================================================================
// Component
// ============================================================================

export function ReviewEmailPreviewModal({
  documentId,
  documentName: _documentName, // Used by backend query, not directly here
  recipientEmail,
  recipientName,
  feedback,
  open,
  onOpenChange,
  onSent,
}: ReviewEmailPreviewModalProps) {
  const [sending, setSending] = useState(false);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const input = {
    documentId,
    recipientEmail,
    recipientName,
    feedback,
  };

  const { data: previewData, loading: loadingPreview } = useQuery<PreviewResult>(PREVIEW_EMAIL, {
    variables: { input },
    skip: !open,
    fetchPolicy: 'network-only',
  });

  const [sendEmail] = useMutation<SendResult>(SEND_EMAIL);

  const handleSend = async () => {
    setSending(true);
    try {
      const result = await sendEmail({
        variables: { input },
      });

      if (result.data?.sendReviewFeedbackEmail.success) {
        addNotification({
          type: 'success',
          title: 'Email trimis',
          message: `Email-ul a fost trimis către ${recipientName}`,
        });
        onOpenChange(false);
        onSent?.();
      } else {
        addNotification({
          type: 'error',
          title: 'Eroare la trimitere',
          message: result.data?.sendReviewFeedbackEmail.error || 'Nu s-a putut trimite email-ul',
        });
      }
    } catch (error) {
      console.error('Error sending email:', error);
      addNotification({
        type: 'error',
        title: 'Eroare la trimitere',
        message: 'Nu s-a putut trimite email-ul',
      });
    } finally {
      setSending(false);
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
    onSent?.();
  };

  const preview = previewData?.previewReviewFeedbackEmail;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Previzualizare email
          </DialogTitle>
          <DialogDescription>
            Revizuiți email-ul înainte de a-l trimite către {recipientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loadingPreview ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : preview ? (
            <>
              {/* Email header */}
              <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-500">Către:</span>
                  <span className="text-gray-900">
                    {preview.toName} &lt;{preview.to}&gt;
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-500">Subiect:</span>
                  <span className="text-gray-900">{preview.subject}</span>
                </div>
              </div>

              {/* Email body */}
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700">
                  {preview.body}
                </pre>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-sm text-gray-500">
              Nu s-a putut genera previzualizarea
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleSkip} disabled={sending}>
            <X className="mr-2 h-4 w-4" />
            Nu trimite
          </Button>
          <Button
            onClick={handleSend}
            disabled={!preview || sending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Se salvează...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvează în Ciorne
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
