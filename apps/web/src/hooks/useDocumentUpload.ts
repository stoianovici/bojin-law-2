/**
 * Document Upload Hook
 * Story 2.9: Document Storage with OneDrive Integration
 *
 * Provides mutations for uploading documents to OneDrive
 */

import { gql, useMutation } from '@apollo/client';
import { useCallback, useState } from 'react';

// GraphQL mutation for uploading document to OneDrive
const UPLOAD_DOCUMENT_TO_ONEDRIVE = gql`
  mutation UploadDocumentToOneDrive($input: UploadDocumentWithFileInput!) {
    uploadDocumentToOneDrive(input: $input) {
      id
      fileName
      fileType
      fileSize
      storagePath
      oneDriveId
      oneDrivePath
      status
      uploadedAt
      uploadedBy {
        id
        firstName
        lastName
      }
      versions {
        id
        versionNumber
        changesSummary
        createdAt
      }
    }
  }
`;

// GraphQL mutation for getting download URL
const GET_DOCUMENT_DOWNLOAD_URL = gql`
  mutation GetDocumentDownloadUrl($documentId: UUID!) {
    getDocumentDownloadUrl(documentId: $documentId) {
      url
      expirationDateTime
    }
  }
`;

// GraphQL mutation for syncing document from OneDrive
const SYNC_DOCUMENT_FROM_ONEDRIVE = gql`
  mutation SyncDocumentFromOneDrive($documentId: UUID!) {
    syncDocumentFromOneDrive(documentId: $documentId) {
      updated
      newVersionNumber
      document {
        id
        fileName
        fileSize
        status
        versions {
          id
          versionNumber
          changesSummary
          createdAt
        }
      }
    }
  }
`;

// GraphQL mutation for updating document status
const UPDATE_DOCUMENT_STATUS = gql`
  mutation UpdateDocumentStatus($documentId: UUID!, $input: UpdateDocumentStatusInput!) {
    updateDocumentStatus(documentId: $documentId, input: $input) {
      id
      status
    }
  }
`;

export interface UploadDocumentInput {
  caseId: string;
  fileName: string;
  fileType: string;
  fileContent: string; // Base64 encoded
  title?: string;
  description?: string;
}

export interface UploadedDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  oneDriveId: string;
  oneDrivePath: string;
  status: string;
  uploadedAt: string;
  uploadedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  versions: {
    id: string;
    versionNumber: number;
    changesSummary: string | null;
    createdAt: string;
  }[];
}

export interface DownloadUrlResponse {
  url: string;
  expirationDateTime: string;
}

export interface SyncResult {
  updated: boolean;
  newVersionNumber: number | null;
  document: UploadedDocument;
}

export interface UploadProgress {
  fileName: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

interface UseDocumentUploadResult {
  uploadDocument: (input: UploadDocumentInput) => Promise<UploadedDocument | null>;
  uploadFiles: (caseId: string, files: File[]) => Promise<UploadedDocument[]>;
  getDownloadUrl: (documentId: string) => Promise<DownloadUrlResponse | null>;
  syncDocument: (documentId: string) => Promise<SyncResult | null>;
  updateStatus: (documentId: string, status: 'DRAFT' | 'FINAL' | 'ARCHIVED') => Promise<boolean>;
  uploading: boolean;
  progress: UploadProgress[];
  error?: Error;
}

/**
 * Hook for document upload operations with OneDrive integration
 */
export function useDocumentUpload(): UseDocumentUploadResult {
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const [uploadMutation] = useMutation(UPLOAD_DOCUMENT_TO_ONEDRIVE);
  const [getDownloadUrlMutation] = useMutation(GET_DOCUMENT_DOWNLOAD_URL);
  const [syncDocumentMutation] = useMutation(SYNC_DOCUMENT_FROM_ONEDRIVE);
  const [updateStatusMutation] = useMutation(UPDATE_DOCUMENT_STATUS);

  // Convert File to base64
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  }, []);

  // Upload single document
  const uploadDocument = useCallback(
    async (input: UploadDocumentInput): Promise<UploadedDocument | null> => {
      try {
        setError(undefined);
        const { data } = await uploadMutation({
          variables: { input },
        });
        return data?.uploadDocumentToOneDrive || null;
      } catch (err) {
        setError(err as Error);
        return null;
      }
    },
    [uploadMutation]
  );

  // Upload multiple files with progress tracking
  const uploadFiles = useCallback(
    async (caseId: string, files: File[]): Promise<UploadedDocument[]> => {
      setUploading(true);
      setError(undefined);

      // Initialize progress for all files
      const initialProgress: UploadProgress[] = files.map((file) => ({
        fileName: file.name,
        progress: 0,
        status: 'pending',
      }));
      setProgress(initialProgress);

      const uploadedDocuments: UploadedDocument[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Update progress to uploading
        setProgress((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, status: 'uploading', progress: 10 } : p
          )
        );

        try {
          // Convert file to base64
          const fileContent = await fileToBase64(file);

          // Update progress
          setProgress((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, progress: 50 } : p
            )
          );

          // Upload to OneDrive
          const result = await uploadDocument({
            caseId,
            fileName: file.name,
            fileType: file.type,
            fileContent,
          });

          if (result) {
            uploadedDocuments.push(result);
            setProgress((prev) =>
              prev.map((p, idx) =>
                idx === i ? { ...p, status: 'complete', progress: 100 } : p
              )
            );
          } else {
            setProgress((prev) =>
              prev.map((p, idx) =>
                idx === i
                  ? { ...p, status: 'error', error: 'Upload failed' }
                  : p
              )
            );
          }
        } catch (err) {
          setProgress((prev) =>
            prev.map((p, idx) =>
              idx === i
                ? { ...p, status: 'error', error: (err as Error).message }
                : p
            )
          );
        }
      }

      setUploading(false);
      return uploadedDocuments;
    },
    [fileToBase64, uploadDocument]
  );

  // Get download URL for a document
  const getDownloadUrl = useCallback(
    async (documentId: string): Promise<DownloadUrlResponse | null> => {
      try {
        setError(undefined);
        const { data } = await getDownloadUrlMutation({
          variables: { documentId },
        });
        return data?.getDocumentDownloadUrl || null;
      } catch (err) {
        setError(err as Error);
        return null;
      }
    },
    [getDownloadUrlMutation]
  );

  // Sync document from OneDrive
  const syncDocument = useCallback(
    async (documentId: string): Promise<SyncResult | null> => {
      try {
        setError(undefined);
        const { data } = await syncDocumentMutation({
          variables: { documentId },
        });
        return data?.syncDocumentFromOneDrive || null;
      } catch (err) {
        setError(err as Error);
        return null;
      }
    },
    [syncDocumentMutation]
  );

  // Update document status
  const updateStatus = useCallback(
    async (documentId: string, status: 'DRAFT' | 'FINAL' | 'ARCHIVED'): Promise<boolean> => {
      try {
        setError(undefined);
        await updateStatusMutation({
          variables: { documentId, input: { status } },
        });
        return true;
      } catch (err) {
        setError(err as Error);
        return false;
      }
    },
    [updateStatusMutation]
  );

  return {
    uploadDocument,
    uploadFiles,
    getDownloadUrl,
    syncDocument,
    updateStatus,
    uploading,
    progress,
    error,
  };
}
