// Document status (simplified: DRAFT → READY_FOR_REVIEW → FINAL)
export type DocumentStatus = 'DRAFT' | 'READY_FOR_REVIEW' | 'FINAL';

// Document source
export type DocumentSource = 'UPLOAD' | 'EMAIL_ATTACHMENT' | 'AI_GENERATED' | 'TEMPLATE';

// File type for icon coloring
export type FileType = 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'image' | 'other';

// User summary for display
export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
}

// Document type
export interface Document {
  id: string;
  /** CaseDocument junction table ID (used for mapa slot assignment) */
  caseDocumentId?: string;
  fileName: string;
  fileType: FileType;
  fileSize: number;
  status: DocumentStatus;
  sourceType: DocumentSource;
  uploadedBy: UserSummary;
  uploadedAt: string;
  caseId: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  versionCount: number;
  metadata?: Record<string, unknown>;
  // Slot assignment (if assigned to a mapa)
  assignedToSlotId?: string;
  assignedToMapaId?: string;
  /** Whether this document is private (Private-by-Default) */
  isPrivate?: boolean;
  /** Sender name from original email (for EMAIL_ATTACHMENT source type) */
  senderName?: string;
  /** Sender email address from original email (for EMAIL_ATTACHMENT source type) */
  senderEmail?: string;
}

// Case with document info for sidebar
export interface CaseWithDocuments {
  id: string;
  caseNumber: string;
  name: string;
  status: 'Active' | 'PendingApproval' | 'OnHold' | 'Closed';
  documentCount: number;
  folders: Folder[];
}

// Client summary for folder display
export interface ClientSummary {
  id: string;
  name: string;
}

// Folder within a case or client
export interface Folder {
  id: string;
  /** Case this folder belongs to (null for client-level folders) */
  caseId?: string | null;
  /** Client this folder belongs to (null for case-level folders) */
  clientId?: string | null;
  /** Client object (null for case-level folders) */
  client?: ClientSummary | null;
  name: string;
  parentId: string | null;
  documentCount: number;
}

// Helper to get file type from extension
export function getFileType(fileName: string): FileType {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'doc':
    case 'docx':
      return 'docx';
    case 'xls':
    case 'xlsx':
      return 'xlsx';
    case 'ppt':
    case 'pptx':
      return 'pptx';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
      return 'image';
    default:
      return 'other';
  }
}

// File type colors
export const fileTypeColors: Record<FileType, string> = {
  pdf: '#EF4444', // red
  docx: '#5E6AD2', // accent blue
  xlsx: '#22C55E', // green
  pptx: '#F59E0B', // orange
  image: '#A855F7', // purple
  other: '#71717A', // gray
};

// Status badge variants (matches Badge component variants)
export const statusBadgeVariants: Record<
  DocumentStatus,
  'warning' | 'info' | 'success' | 'default'
> = {
  DRAFT: 'warning',
  READY_FOR_REVIEW: 'info',
  FINAL: 'success',
};

// Status labels (Romanian)
export const statusLabels: Record<DocumentStatus, string> = {
  DRAFT: 'Ciornă',
  READY_FOR_REVIEW: 'De revizuit',
  FINAL: 'Final',
};

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}
