'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, Loader2, AlertCircle, X, FileText, Check } from 'lucide-react';
import { useMutation } from '@apollo/client/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { UPLOAD_DOCUMENT_TO_SHAREPOINT } from '@/graphql/mutations';
import { GET_CASE_DOCUMENTS } from '@/graphql/queries';

// ============================================================================
// Types
// ============================================================================

export interface UploadDocumentModalProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Case ID to upload document to */
  caseId: string;
  /** Callback when document is successfully uploaded */
  onSuccess?: () => void;
}

interface SelectedFile {
  file: File;
  base64: string;
  preview?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
];

// ============================================================================
// Helpers
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:application/pdf;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// UploadDocumentModal Component
// ============================================================================

export function UploadDocumentModal({
  open,
  onOpenChange,
  caseId,
  onSuccess,
}: UploadDocumentModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [processWithAI, setProcessWithAI] = useState(false);

  const [uploadDocument] = useMutation(UPLOAD_DOCUMENT_TO_SHAREPOINT, {
    refetchQueries: [{ query: GET_CASE_DOCUMENTS, variables: { caseId } }],
  });

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      const timeout = setTimeout(() => {
        setSelectedFiles([]);
        setError(null);
        setUploadingIndex(null);
        setUploadedCount(0);
        setProcessWithAI(false);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  // Handle file selection
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setError(null);
    const newFiles: SelectedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setError(`Fișierul "${file.name}" depășește limita de 100MB`);
        continue;
      }

      // Validate file type
      if (
        !ALLOWED_TYPES.includes(file.type) &&
        !file.name.match(/\.(doc|docx|xls|xlsx|ppt|pptx|pdf|txt|jpg|jpeg|png|gif|webp)$/i)
      ) {
        setError(`Tipul fișierului "${file.name}" nu este suportat`);
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
        newFiles.push({ file, base64, preview });
      } catch {
        setError(`Nu s-a putut citi fișierul "${file.name}"`);
      }
    }

    setSelectedFiles((prev) => [...prev, ...newFiles]);
  }, []);

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  // Remove a file from selection
  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => {
      const newFiles = [...prev];
      // Clean up preview URL if it exists
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  }, []);

  // Upload all files
  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    setError(null);
    setUploadedCount(0);

    for (let i = 0; i < selectedFiles.length; i++) {
      setUploadingIndex(i);
      const { file, base64 } = selectedFiles[i];

      try {
        await uploadDocument({
          variables: {
            input: {
              caseId,
              fileName: file.name,
              fileType: file.type || 'application/octet-stream',
              fileContent: base64,
              processWithAI,
            },
          },
        });
        setUploadedCount((prev) => prev + 1);
      } catch (err) {
        setError(
          `Eroare la încărcarea "${file.name}": ${err instanceof Error ? err.message : 'Eroare necunoscută'}`
        );
        setUploadingIndex(null);
        return;
      }
    }

    setUploadingIndex(null);
    onOpenChange(false);
    onSuccess?.();
  }, [selectedFiles, caseId, uploadDocument, onOpenChange, onSuccess]);

  const isUploading = uploadingIndex !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Încarcă documente</DialogTitle>
          <DialogDescription>
            Selectați sau trageți fișierele pe care doriți să le încărcați în dosar.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 px-6 space-y-4">
          {/* Drop Zone */}
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
              isDragging
                ? 'border-linear-accent bg-linear-accent/5'
                : 'border-linear-border-subtle hover:border-linear-border-hover',
              isUploading && 'opacity-50 pointer-events-none'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-10 h-10 mx-auto mb-3 text-linear-text-muted" />
            <p className="text-sm text-linear-text-secondary mb-1">
              Trageți fișierele aici sau faceți click pentru a selecta
            </p>
            <p className="text-xs text-linear-text-muted">
              PDF, Word, Excel, PowerPoint, imagini (max 100MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
              accept={ALLOWED_TYPES.join(',')}
            />
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-linear-text-secondary">
                {selectedFiles.length} fișier{selectedFiles.length !== 1 ? 'e' : ''} selectat
                {selectedFiles.length !== 1 ? 'e' : ''}
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {selectedFiles.map((item, index) => (
                  <div
                    key={`${item.file.name}-${index}`}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border',
                      index < uploadedCount
                        ? 'bg-linear-success/5 border-linear-success/30'
                        : uploadingIndex === index
                          ? 'bg-linear-accent/5 border-linear-accent/30'
                          : 'bg-linear-bg-secondary border-linear-border-subtle'
                    )}
                  >
                    {/* File Icon/Preview */}
                    <div className="w-10 h-10 rounded-md bg-linear-bg-elevated flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {item.preview ? (
                        <img
                          src={item.preview}
                          alt={item.file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="w-5 h-5 text-linear-text-muted" />
                      )}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-linear-text-primary truncate">
                        {item.file.name}
                      </p>
                      <p className="text-xs text-linear-text-muted">
                        {formatFileSize(item.file.size)}
                      </p>
                    </div>

                    {/* Status/Actions */}
                    {index < uploadedCount ? (
                      <Check className="w-5 h-5 text-linear-success flex-shrink-0" />
                    ) : uploadingIndex === index ? (
                      <Loader2 className="w-5 h-5 text-linear-accent animate-spin flex-shrink-0" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        disabled={isUploading}
                        className={cn(
                          'p-1 rounded-md text-linear-text-tertiary',
                          'hover:text-linear-text-primary hover:bg-linear-bg-hover',
                          'transition-colors',
                          isUploading && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Processing Checkbox */}
          {selectedFiles.length > 0 && (
            <div className="flex items-center gap-3 p-3 bg-linear-bg-secondary rounded-lg">
              <input
                type="checkbox"
                id="processWithAI"
                checked={processWithAI}
                onChange={(e) => setProcessWithAI(e.target.checked)}
                disabled={isUploading}
                className="h-4 w-4 rounded border-linear-border-subtle text-linear-accent focus:ring-linear-accent"
              />
              <div className="flex-1">
                <label
                  htmlFor="processWithAI"
                  className="text-sm font-medium text-linear-text-primary cursor-pointer"
                >
                  Procesează cu AI
                </label>
                <p className="text-xs text-linear-text-muted">
                  Extrage conținutul pentru sumarizare și analiză AI
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              className={cn(
                'flex items-start gap-2 p-3 rounded-lg',
                'bg-linear-error/10 border border-linear-error/30'
              )}
            >
              <AlertCircle className="w-4 h-4 text-linear-error flex-shrink-0 mt-0.5" />
              <p className="text-sm text-linear-error">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            Anulează
          </Button>
          <Button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
            loading={isUploading}
          >
            {isUploading ? (
              `Se încarcă ${uploadingIndex! + 1}/${selectedFiles.length}...`
            ) : (
              <>
                <Upload className="w-4 h-4 mr-1.5" />
                Încarcă {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

UploadDocumentModal.displayName = 'UploadDocumentModal';

export default UploadDocumentModal;
