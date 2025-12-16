'use client';

/**
 * Edit in Word Button Component
 * Story 3.4: Word Integration with Live AI Assistance
 *
 * Opens a document in Microsoft Word desktop application.
 * Handles document locking and generates ms-word: protocol URL.
 */

import React, { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText, Lock, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// GraphQL Operations
const GET_DOCUMENT_LOCK_STATUS = gql`
  query GetDocumentLockStatus($documentId: UUID!) {
    documentLockStatus(documentId: $documentId) {
      isLocked
      currentUserHoldsLock
      lock {
        id
        user {
          firstName
          lastName
          email
        }
        expiresAt
      }
    }
  }
`;

const OPEN_IN_WORD = gql`
  mutation OpenInWord($documentId: UUID!) {
    openInWord(documentId: $documentId) {
      documentId
      wordUrl
      lockToken
      expiresAt
      oneDriveId
    }
  }
`;

interface EditInWordButtonProps {
  documentId: string;
  documentName?: string;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

interface LockUser {
  firstName: string;
  lastName: string;
  email: string;
}

interface LockStatusData {
  documentLockStatus: {
    isLocked: boolean;
    currentUserHoldsLock: boolean;
    lock?: {
      id: string;
      user: LockUser;
      expiresAt: string;
    };
  };
}

export function EditInWordButton({
  documentId,
  documentName,
  disabled = false,
  variant = 'outline',
  size = 'default',
  className,
}: EditInWordButtonProps) {
  const [showLockedDialog, setShowLockedDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [lockHolder, setLockHolder] = useState<{ name: string; email: string } | null>(null);

  // Query lock status
  const {
    data: lockData,
    loading: lockLoading,
    refetch: refetchLockStatus,
  } = useQuery<LockStatusData>(GET_DOCUMENT_LOCK_STATUS, {
    variables: { documentId },
    pollInterval: 30000, // Poll every 30 seconds
  });

  // Open in Word mutation
  interface OpenInWordData {
    openInWord: {
      documentId: string;
      wordUrl: string;
      lockToken: string;
      expiresAt: string;
      oneDriveId: string;
    };
  }
  const [openInWord, { loading: opening }] = useMutation<OpenInWordData>(OPEN_IN_WORD, {
    onCompleted: (data) => {
      // Store lock token in localStorage for renewal
      localStorage.setItem(
        `word-lock-${documentId}`,
        JSON.stringify({
          lockToken: data.openInWord.lockToken,
          expiresAt: data.openInWord.expiresAt,
        })
      );

      // Open Word using protocol URL
      window.location.href = data.openInWord.wordUrl;

      toast.success('Opening document in Word...', {
        description: 'Word should open automatically. If not, check your browser settings.',
      });

      // Refetch lock status
      refetchLockStatus();
    },
    onError: (error: Error) => {
      if (error.message.includes('locked by')) {
        // Parse lock holder from error message
        const match = error.message.match(/locked by (.+) \((.+)\)/);
        if (match) {
          setLockHolder({ name: match[1], email: match[2] });
          setShowLockedDialog(true);
        }
      } else if (error.message.includes('OneDrive')) {
        toast.error('Document not in OneDrive', {
          description: 'Please upload this document to OneDrive first to edit in Word.',
        });
      } else {
        toast.error('Failed to open in Word', {
          description: error.message,
        });
      }
    },
  });

  const handleClick = useCallback(() => {
    if (
      lockData?.documentLockStatus?.isLocked &&
      !lockData.documentLockStatus.currentUserHoldsLock
    ) {
      const lock = lockData.documentLockStatus.lock;
      if (lock) {
        setLockHolder({
          name: `${lock.user.firstName} ${lock.user.lastName}`,
          email: lock.user.email,
        });
        setShowLockedDialog(true);
      }
    } else {
      setShowConfirmDialog(true);
    }
  }, [lockData]);

  const handleConfirmOpen = useCallback(() => {
    setShowConfirmDialog(false);
    openInWord({ variables: { documentId } });
  }, [documentId, openInWord]);

  const isLocked = lockData?.documentLockStatus?.isLocked;
  const currentUserHoldsLock = lockData?.documentLockStatus?.currentUserHoldsLock;

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              className={className}
              onClick={handleClick}
              disabled={disabled || lockLoading || opening}
            >
              {opening ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : isLocked && !currentUserHoldsLock ? (
                <Lock className="h-4 w-4 mr-2 text-orange-500" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              {size !== 'icon' && (
                <>
                  {opening ? 'Opening...' : 'Edit in Word'}
                  <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isLocked && !currentUserHoldsLock ? (
              <p>Document is currently being edited by another user</p>
            ) : currentUserHoldsLock ? (
              <p>You are currently editing this document</p>
            ) : (
              <p>Open in Microsoft Word for advanced editing</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Locked by another user dialog */}
      <Dialog open={showLockedDialog} onOpenChange={setShowLockedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-orange-500" />
              Document is Locked
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <p>
                This document is currently being edited by <strong>{lockHolder?.name}</strong> (
                {lockHolder?.email}).
              </p>
              <p>
                You can view the document but cannot edit it until the other user finishes editing.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLockedDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm open dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Edit in Microsoft Word
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <p>
                Opening <strong>{documentName || 'this document'}</strong> in Microsoft Word.
              </p>
              <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                <p className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span>The document will be locked while you edit.</span>
                </p>
                <p className="ml-6">Other users will not be able to edit until you close Word.</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Changes you make in Word will be automatically synced back to the platform.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmOpen} disabled={opening}>
              {opening ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  Open in Word
                  <ExternalLink className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default EditInWordButton;
