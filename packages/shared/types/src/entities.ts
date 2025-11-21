/**
 * Entity Types for Legal Platform
 * Based on architecture/data-models.md
 */

// Enums
export type UserRole = 'Partner' | 'Associate' | 'Paralegal';
export type UserStatus = 'Pending' | 'Active' | 'Inactive';
export type CaseStatus = 'Active' | 'OnHold' | 'Closed' | 'Archived';
export type CaseType = 'Litigation' | 'Contract' | 'Advisory' | 'Criminal' | 'Other';
export type CaseActorRole = 'Client' | 'OpposingParty' | 'OpposingCounsel' | 'Witness' | 'Expert';
export type CasePriority = 'Low' | 'Medium' | 'High';
export type DocumentType = 'Contract' | 'Motion' | 'Letter' | 'Memo' | 'Pleading' | 'Other';
export type DocumentStatus = 'Draft' | 'Review' | 'Approved' | 'Filed';
export type TaskType =
  | 'Research'
  | 'DocumentCreation'
  | 'DocumentRetrieval'
  | 'CourtDate'
  | 'Meeting'
  | 'BusinessTrip';

// User Entity
export interface User {
  id: string; // UUID
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  firmId: string | null; // UUID (nullable for pending users)
  azureAdId: string;
  preferences: Record<string, unknown>;
  createdAt: Date;
  lastActive: Date;
}

// Client Entity (referenced by Case)
export interface Client {
  id: string; // UUID
  firmId: string; // UUID
  name: string;
  contactInfo: Record<string, unknown>; // JSON - email, phone, etc.
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Case Team Member
export interface CaseTeamMember {
  userId: string; // UUID
  role: string;
  assignedDate: Date;
}

// Case Entity
export interface Case {
  id: string; // UUID
  firmId: string; // UUID
  caseNumber: string;
  title: string;
  clientId: string; // UUID
  status: CaseStatus;
  type: CaseType;
  description: string;
  openedDate: Date;
  closedDate: Date | null;
  value: number | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Case Team (join table between Case and User)
export interface CaseTeam {
  id: string; // UUID
  caseId: string; // UUID
  userId: string; // UUID
  role: string; // "Lead", "Support", "Observer", etc.
  assignedAt: Date;
  assignedBy: string | null; // UUID (User ID)
}

// Case Audit Log (tracks all case modifications)
export interface CaseAuditLog {
  id: string; // UUID
  caseId: string; // UUID
  userId: string | null; // UUID (User ID who made the change)
  action: string; // "CREATED", "UPDATED", "ARCHIVED", "TEAM_ASSIGNED", etc.
  fieldName: string | null; // Which field was changed
  oldValue: string | null;
  newValue: string | null;
  timestamp: Date;
}

// Case Actor (external parties involved in the case)
export interface CaseActor {
  id: string; // UUID
  caseId: string; // UUID
  role: CaseActorRole;
  name: string;
  organization: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null; // UUID (User ID)
}

// Attorney/User reference for case overview
export interface Attorney {
  id: string;
  name: string;
  initials: string;
}

// Case Overview (for cases list/grid view with enriched information)
export interface CaseOverview {
  id: string;
  caseNumber: string;
  title: string;
  clientName: string;
  caseType: CaseType;
  status: CaseStatus;
  assignedAttorneys: Attorney[];
  lastActivityDate: Date;
  nextDeadline?: Date;
  priority: CasePriority;
  // Hover stats
  documentCount?: number;
  taskCount?: number;
}

// Document Entity
export interface Document {
  id: string; // UUID
  caseId: string; // UUID
  title: string;
  type: DocumentType;
  currentVersion: number;
  status: DocumentStatus;
  blobStorageUrl: string;
  aiGenerated: boolean;
  createdBy: string; // UUID (User ID)
  createdAt: Date;
  updatedAt: Date;
}

// Document Overview (for documents list view with enriched information for filtering/sorting)
export type FileType = 'PDF' | 'DOCX' | 'XLSX' | 'TXT' | 'Other';

export interface DocumentOverview {
  id: string;
  title: string;
  caseId: string;
  caseName: string; // Denormalized for display and filtering
  type: DocumentType;
  fileType: FileType;
  fileSizeBytes: number;
  pageCount?: number;
  uploadedDate: Date;
  lastModifiedDate: Date;
  uploadedBy: string; // Attorney name
  uploadedById: string; // Attorney ID for filtering
  status?: DocumentStatus;
  isReviewed?: boolean;
  isSigned?: boolean;
}

// Document Version
export interface DocumentVersion {
  id: string; // UUID
  documentId: string; // UUID
  versionNumber: number;
  changesSummary: string;
  createdAt: Date;
  createdBy: string; // UUID (User ID)
}

// Task Metadata (flexible structure with known communication-related fields)
export interface TaskMetadata {
  sourceMessageId?: string; // Link to originating message
  sourceThreadId?: string; // Link to thread
  extractedItemId?: string; // Link to specific extracted item
  extractedItemType?: 'deadline' | 'commitment' | 'actionItem';
  [key: string]: unknown; // Allow other metadata
}

// Task Entity
export interface Task {
  id: string; // UUID
  caseId: string; // UUID
  type: TaskType;
  title: string;
  description: string;
  assignedTo: string; // UUID (User ID)
  dueDate: Date;
  status: 'Pending' | 'InProgress' | 'Completed' | 'Cancelled';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  metadata: TaskMetadata;
  createdAt: Date;
  updatedAt: Date;
}

// Factory override types for testing
export type UserOverrides = Partial<User>;
export type ClientOverrides = Partial<Client>;
export type CaseOverrides = Partial<Case>;
export type CaseTeamOverrides = Partial<CaseTeam>;
export type CaseTeamMemberOverrides = Partial<CaseTeamMember>;
export type CaseAuditLogOverrides = Partial<CaseAuditLog>;
export type CaseActorOverrides = Partial<CaseActor>;
export type DocumentOverrides = Partial<Document>;
export type DocumentVersionOverrides = Partial<DocumentVersion>;
export type TaskOverrides = Partial<Task>;
