'use client';

import { useMemo } from 'react';
import { useQuery } from './useGraphQL';
import { useAuth } from './useAuth';
import { GET_CASES, GET_CASE_DOCUMENTS, GET_CLIENT_INBOX_DOCUMENTS } from '@/graphql/queries';

// Types matching gateway schema
export interface DocumentUploader {
  id: string;
  firstName: string;
  lastName: string;
}

export type DocumentSourceType = 'UPLOAD' | 'EMAIL_ATTACHMENT' | 'AI_GENERATED' | 'TEMPLATE';

export interface DocumentData {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: 'DRAFT' | 'IN_REVIEW' | 'CHANGES_REQUESTED' | 'PENDING' | 'FINAL' | 'ARCHIVED';
  sourceType: DocumentSourceType;
  uploadedAt: string;
  thumbnailMedium?: string;
  uploadedBy: DocumentUploader;
  isPrivate?: boolean;
  senderName?: string;
  senderEmail?: string;
  client?: {
    id: string;
    name: string;
  };
}

export interface CaseDocumentWithContext {
  id: string;
  document: DocumentData;
  linkedAt: string;
  receivedAt: string;
  linkedBy?: DocumentUploader;
  isOriginal: boolean;
  promotedFromAttachment: boolean;
}

export interface CaseData {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  type: string;
  client?: {
    id: string;
    name: string;
  };
}

// Query result types
interface CasesQueryResult {
  cases: CaseData[];
}

interface CaseDocumentsQueryResult {
  caseDocuments: CaseDocumentWithContext[];
}

interface ClientInboxDocumentsQueryResult {
  clientInboxDocuments: CaseDocumentWithContext[];
}

// Hook to get all cases for sidebar
export function useCases() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Skip query until auth is ready to ensure x-mock-user header is sent
  const shouldSkip = authLoading || !isAuthenticated;

  const { data, loading, error, refetch } = useQuery<CasesQueryResult>(GET_CASES, {
    skip: shouldSkip,
  });

  return {
    cases: data?.cases ?? [],
    loading: authLoading || loading,
    error,
    refetch,
  };
}

// Hook to get documents for a specific case
export function useCaseDocuments(caseId: string | null) {
  const { data, loading, error, refetch } = useQuery<CaseDocumentsQueryResult>(GET_CASE_DOCUMENTS, {
    variables: { caseId },
    skip: !caseId,
  });

  return {
    documents: data?.caseDocuments ?? [],
    loading,
    error,
    refetch,
  };
}

// Hook to get client inbox documents (not assigned to any case)
export function useClientInboxDocuments(clientId: string | null) {
  const { data, loading, error, refetch } = useQuery<ClientInboxDocumentsQueryResult>(
    GET_CLIENT_INBOX_DOCUMENTS,
    {
      variables: { clientId },
      skip: !clientId,
    }
  );

  return {
    documents: data?.clientInboxDocuments ?? [],
    loading,
    error,
    refetch,
  };
}

// Transform gateway document to UI document format
export function transformDocument(
  caseDoc: CaseDocumentWithContext,
  caseId: string
): import('@/types/document').Document {
  const doc = caseDoc.document;

  // Determine file type category
  const getFileType = (mimeOrExt: string): 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'image' | 'other' => {
    const lower = mimeOrExt.toLowerCase();
    if (lower.includes('pdf')) return 'pdf';
    if (lower.includes('word') || lower.includes('docx') || lower.includes('doc')) return 'docx';
    if (lower.includes('excel') || lower.includes('xlsx') || lower.includes('xls')) return 'xlsx';
    if (lower.includes('powerpoint') || lower.includes('pptx') || lower.includes('ppt'))
      return 'pptx';
    if (
      lower.includes('image') ||
      lower.includes('png') ||
      lower.includes('jpg') ||
      lower.includes('jpeg')
    )
      return 'image';
    return 'other';
  };

  // Map status
  const mapStatus = (status: string): 'DRAFT' | 'PENDING' | 'FINAL' | 'ARCHIVED' => {
    switch (status) {
      case 'DRAFT':
      case 'IN_REVIEW':
      case 'CHANGES_REQUESTED':
        return 'DRAFT';
      case 'PENDING':
        return 'PENDING';
      case 'FINAL':
        return 'FINAL';
      case 'ARCHIVED':
        return 'ARCHIVED';
      default:
        return 'DRAFT';
    }
  };

  // Determine effective source type for categorization
  // Email attachments that have been promoted are treated as working documents
  const effectiveSourceType = caseDoc.promotedFromAttachment
    ? 'UPLOAD' // Promoted attachments become working documents
    : doc.sourceType || 'UPLOAD';

  return {
    id: doc.id,
    caseDocumentId: caseDoc.id,
    fileName: doc.fileName,
    fileType: getFileType(doc.fileType),
    fileSize: doc.fileSize,
    status: mapStatus(doc.status),
    sourceType: effectiveSourceType as import('@/types/document').DocumentSource,
    uploadedBy: {
      id: doc.uploadedBy.id,
      firstName: doc.uploadedBy.firstName,
      lastName: doc.uploadedBy.lastName,
      initials:
        `${doc.uploadedBy.firstName[0] || ''}${doc.uploadedBy.lastName[0] || ''}`.toUpperCase(),
    },
    uploadedAt: doc.uploadedAt,
    caseId,
    thumbnailUrl: doc.thumbnailMedium,
    versionCount: 1,
    isPrivate: doc.isPrivate ?? false,
    senderName: doc.senderName,
    senderEmail: doc.senderEmail,
  };
}

// Hook to get all documents from all cases for quick access filters
export function useAllCaseDocuments(caseIds: string[]) {
  const { user } = useAuth();

  // We'll create a map of case queries
  // For now, we'll rely on the parent component to pass already-fetched documents
  // This is a placeholder for when we implement batch fetching

  return {
    // Return filter functions that can be used with fetched documents
    filterRecent: (
      documents: import('@/types/document').Document[],
      limit = 20
    ): import('@/types/document').Document[] => {
      return [...documents]
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
        .slice(0, limit);
    },

    filterFavorites: (
      documents: import('@/types/document').Document[]
    ): import('@/types/document').Document[] => {
      // TODO: Implement favorites when backend supports it
      // For now, return empty array
      return documents.filter((d) => (d as unknown as { isFavorite?: boolean }).isFavorite);
    },

    filterMyUploads: (
      documents: import('@/types/document').Document[]
    ): import('@/types/document').Document[] => {
      if (!user?.id) return [];
      return documents.filter((d) => d.uploadedBy.id === user.id);
    },
  };
}
