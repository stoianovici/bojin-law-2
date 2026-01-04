'use client';

import { useQuery } from './useGraphQL';
import { GET_CASES, GET_CASE_DOCUMENTS } from '@/graphql/queries';

// Types matching gateway schema
export interface DocumentUploader {
  id: string;
  firstName: string;
  lastName: string;
}

export interface DocumentData {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: 'DRAFT' | 'IN_REVIEW' | 'CHANGES_REQUESTED' | 'PENDING' | 'FINAL' | 'ARCHIVED';
  uploadedAt: string;
  thumbnailMedium?: string;
  uploadedBy: DocumentUploader;
}

export interface CaseDocumentWithContext {
  id: string;
  document: DocumentData;
  linkedAt: string;
  linkedBy?: DocumentUploader;
  isOriginal: boolean;
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

// Hook to get all cases for sidebar
export function useCases() {
  const { data, loading, error, refetch } = useQuery<CasesQueryResult>(GET_CASES);

  return {
    cases: data?.cases ?? [],
    loading,
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

  return {
    id: doc.id,
    fileName: doc.fileName,
    fileType: getFileType(doc.fileType),
    fileSize: doc.fileSize,
    status: mapStatus(doc.status),
    sourceType: 'UPLOAD',
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
  };
}
