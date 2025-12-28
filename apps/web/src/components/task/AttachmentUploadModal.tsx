/**
 * AttachmentUploadModal Component
 * Story 4.6: Task Collaboration and Updates (AC: 3)
 *
 * Modal for uploading task attachments with drag-and-drop support
 */

'use client';

import React, { useState, useRef, useCallback } from 'react';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import {
  formatFileSize,
  getFileIcon,
  isAllowedFileType,
  MAX_FILE_SIZE,
} from '@/hooks/useTaskAttachments';

interface AttachmentUploadModalProps {
  taskId: string;
  onClose: () => void;
  onUploadComplete: () => void;
}

const UPLOAD_ATTACHMENT = gql`
  mutation UploadTaskAttachment($taskId: ID!, $file: Upload!) {
    uploadTaskAttachment(taskId: $taskId, file: $file) {
      id
      fileName
      fileSize
      mimeType
    }
  }
`;

interface FileWithPreview extends File {
  preview?: string;
}

export function AttachmentUploadModal({
  taskId,
  onClose,
  onUploadComplete,
}: AttachmentUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [uploadMutation] = useMutation(UPLOAD_ATTACHMENT);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name}: Fișierul depășește limita de 50MB`;
    }
    if (!isAllowedFileType(file.type)) {
      return `${file.name}: Tip de fișier neacceptat`;
    }
    return null;
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const newErrors: string[] = [];
    const validFiles: FileWithPreview[] = [];

    fileArray.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        newErrors.push(error);
      } else {
        validFiles.push(file);
      }
    });

    setErrors((prev) => [...prev, ...newErrors]);
    setFiles((prev) => [...prev, ...validFiles]);
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files?.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addFiles(e.target.files);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setErrors([]);

    const uploadErrors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));

      try {
        await uploadMutation({
          variables: { taskId, file },
          context: {
            hasUpload: true,
          },
        });

        setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));
      } catch (err) {
        uploadErrors.push(`${file.name}: Eroare la încărcare`);
        setUploadProgress((prev) => ({ ...prev, [file.name]: -1 }));
      }
    }

    setUploading(false);

    if (uploadErrors.length > 0) {
      setErrors(uploadErrors);
    } else {
      onUploadComplete();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-linear-bg-secondary rounded-lg shadow-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Încarcă Atașamente</h3>
          <button
            onClick={onClose}
            disabled={uploading}
            className="text-linear-text-muted hover:text-linear-text-secondary disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging ? 'border-linear-accent bg-linear-accent/10' : 'border-linear-border hover:border-linear-border-hover'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt"
          />

          <svg
            className="w-12 h-12 mx-auto text-linear-text-muted mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          <p className="text-linear-text-secondary mb-1">
            Trageți fișierele aici sau <span className="text-linear-accent">click pentru selectare</span>
          </p>
          <p className="text-xs text-linear-text-tertiary">
            PDF, Word, Excel, PowerPoint, imagini. Max 50MB per fișier.
          </p>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mt-4 p-3 bg-linear-error/10 border border-linear-error/30 rounded-lg">
            {errors.map((error, i) => (
              <p key={i} className="text-sm text-linear-error">
                {error}
              </p>
            ))}
          </div>
        )}

        {/* Selected files */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
            {files.map((file, index) => (
              <div key={index} className="flex items-center gap-3 p-2 bg-linear-bg-tertiary rounded-lg">
                <span className="text-xl">{getFileIcon(file.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-linear-text-primary truncate">{file.name}</p>
                  <p className="text-xs text-linear-text-tertiary">{formatFileSize(file.size)}</p>
                </div>
                {uploading ? (
                  <div className="w-16">
                    {uploadProgress[file.name] === -1 ? (
                      <span className="text-xs text-linear-error">Eroare</span>
                    ) : uploadProgress[file.name] === 100 ? (
                      <span className="text-xs text-linear-success">Gata</span>
                    ) : (
                      <div className="h-1.5 bg-linear-bg-hover rounded-full overflow-hidden">
                        <div
                          className="h-full bg-linear-accent transition-all"
                          style={{ width: `${uploadProgress[file.name] || 0}%` }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="p-1 text-linear-text-muted hover:text-linear-error"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-sm text-linear-text-secondary hover:bg-linear-bg-tertiary rounded-md disabled:opacity-50"
          >
            Anulează
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="px-4 py-2 text-sm bg-linear-accent text-white rounded-md hover:bg-linear-accent-hover disabled:opacity-50 flex items-center gap-2"
          >
            {uploading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Se încarcă...
              </>
            ) : (
              `Încarcă ${files.length} fișier${files.length !== 1 ? 'e' : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AttachmentUploadModal;
