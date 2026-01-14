'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { FileText, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
} from '@/components/ui';
import { CREATE_BLANK_DOCUMENT } from '@/graphql/mutations';
import { GET_CASE_DOCUMENTS, GET_CLIENT_INBOX_DOCUMENTS } from '@/graphql/queries';

interface CreateDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Case ID for case-level documents (provide caseId OR clientId) */
  caseId?: string;
  /** Client ID for client inbox documents (provide caseId OR clientId) */
  clientId?: string;
  onSuccess?: () => void;
}

interface CreateBlankDocumentResult {
  createBlankDocument: {
    success: boolean;
    document?: {
      id: string;
      fileName: string;
      fileType: string;
      fileSize: number;
      status: string;
      uploadedAt: string;
    };
    wordUrl?: string;
    webUrl?: string;
    lockToken?: string;
    lockExpiresAt?: string;
    error?: string;
  };
}

export function CreateDocumentModal({
  open,
  onOpenChange,
  caseId,
  clientId,
  onSuccess,
}: CreateDocumentModalProps) {
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Determine which refetch query to use based on mode
  const refetchQueries = caseId
    ? [{ query: GET_CASE_DOCUMENTS, variables: { caseId } }]
    : clientId
      ? [{ query: GET_CLIENT_INBOX_DOCUMENTS, variables: { clientId } }]
      : [];

  const [createBlankDocument, { loading }] = useMutation<CreateBlankDocumentResult>(
    CREATE_BLANK_DOCUMENT,
    {
      refetchQueries,
      onCompleted: (data) => {
        console.log('[CreateDocument] Mutation completed:', data.createBlankDocument);

        if (data.createBlankDocument.success) {
          // Open Word with the new document
          const { wordUrl, webUrl, document: createdDoc } = data.createBlankDocument;

          console.log('[CreateDocument] Document created:', {
            documentId: createdDoc?.id,
            fileName: createdDoc?.fileName,
            wordUrl,
            webUrl,
          });

          // Close modal first
          setFileName('');
          setError(null);
          onOpenChange(false);
          onSuccess?.();

          // Open Word after a short delay to allow UI updates
          setTimeout(() => {
            if (webUrl) {
              // Open SharePoint URL - opens in Word Online, can switch to desktop
              console.log('[CreateDocument] Opening webUrl:', webUrl);
              const popup = window.open(webUrl, '_blank');
              if (!popup) {
                console.warn('[CreateDocument] Pop-up blocked! URL:', webUrl);
                // Show alert so user knows what happened
                alert(
                  `Document creat cu succes!\n\nWord nu s-a deschis automat (pop-up blocat).\n\nURL: ${webUrl}`
                );
              }
            } else if (wordUrl) {
              // Fallback to ms-word: protocol
              console.log('[CreateDocument] Opening wordUrl:', wordUrl);
              const link = document.createElement('a');
              link.href = wordUrl;
              link.click();
            } else {
              console.warn('[CreateDocument] No Word URL returned from createBlankDocument');
              alert('Document creat cu succes, dar nu s-a putut deschide Word (lipsește URL-ul).');
            }
          }, 200);
        } else {
          console.error('[CreateDocument] Mutation failed:', data.createBlankDocument.error);
          setError(data.createBlankDocument.error || 'Eroare la crearea documentului');
        }
      },
      onError: (err) => {
        setError(err.message || 'Eroare la crearea documentului');
      },
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fileName.trim()) {
      setError('Introduceți numele documentului');
      return;
    }

    if (!caseId && !clientId) {
      setError('Trebuie specificat fie un dosar, fie un client');
      return;
    }

    setError(null);
    createBlankDocument({
      variables: {
        input: {
          // Pass either caseId or clientId, not both
          ...(caseId ? { caseId } : { clientId }),
          fileName: fileName.trim(),
        },
      },
    });
  };

  const handleClose = () => {
    if (!loading) {
      setFileName('');
      setError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Document nou
          </DialogTitle>
          <DialogDescription>
            Creați un document Word gol care se va deschide automat în Microsoft Word.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4 px-6">
            <div className="space-y-2">
              <label htmlFor="fileName" className="text-sm font-medium text-linear-text-primary">
                Nume document
              </label>
              <Input
                id="fileName"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="ex: Contract de vanzare"
                disabled={loading}
                autoFocus
              />
              <p className="text-xs text-linear-text-tertiary">
                Extensia .docx va fi adăugată automat
              </p>
            </div>

            {error && (
              <div className="text-sm text-linear-error bg-linear-error/10 px-3 py-2 rounded-md">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
              Anulează
            </Button>
            <Button type="submit" disabled={loading || !fileName.trim()}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Se creează...
                </>
              ) : (
                'Creează și deschide în Word'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

CreateDocumentModal.displayName = 'CreateDocumentModal';

export default CreateDocumentModal;
