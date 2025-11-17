/**
 * Entity Types for Legal Platform
 * Based on architecture/data-models.md
 */

// Enums
export type UserRole = 'Partner' | 'Associate' | 'Paralegal';
export type CaseStatus = 'Active' | 'OnHold' | 'Closed' | 'Archived';
export type CaseType = 'Litigation' | 'Contract' | 'Advisory' | 'Criminal' | 'Other';
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
  firmId: string; // UUID
  azureAdId: string;
  preferences: Record<string, unknown>;
  createdAt: Date;
  lastActive: Date;
}

// Client Entity (referenced by Case)
export interface Client {
  id: string; // UUID
  name: string;
  email: string;
  phone: string;
  address: string;
  firmId: string; // UUID
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
export type CaseTeamMemberOverrides = Partial<CaseTeamMember>;
export type DocumentOverrides = Partial<Document>;
export type DocumentVersionOverrides = Partial<DocumentVersion>;
export type TaskOverrides = Partial<Task>;
