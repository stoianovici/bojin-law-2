/**
 * Entity Types for Legal Platform
 * Based on architecture/data-models.md
 */

// Imports
import type { TaskTypeMetadata } from './task-types';

// Enums
// Story 2.11.1: Added BusinessOwner role for firm-wide financial data access
export type UserRole = 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
export type UserStatus = 'Pending' | 'Active' | 'Inactive';
export type CaseStatus = 'PendingApproval' | 'Active' | 'OnHold' | 'Closed' | 'Archived';
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

// Billing enums (Story 2.8.1, 2.11.2)
export type BillingType = 'Hourly' | 'Fixed' | 'Retainer';
export type RateType = 'partner' | 'associate' | 'paralegal' | 'fixed';

// Retainer enums (Story 2.11.2)
export type RetainerPeriod = 'Monthly' | 'Quarterly' | 'Annually';

// Approval enums (Story 2.8.2)
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

// Notification enums (Story 2.8.2)
export type NotificationType = 'CasePendingApproval' | 'CaseApproved' | 'CaseRejected';

// Document audit action types (Story 2.8.4)
export type DocumentAuditAction =
  | 'Uploaded'
  | 'LinkedToCase'
  | 'UnlinkedFromCase'
  | 'PermanentlyDeleted'
  | 'MetadataUpdated';

// Financial data scope types (Story 2.11.1)
// 'own' - User can only access financial data for cases they manage (Partner)
// 'firm' - User can access financial data for all firm cases (BusinessOwner)
export type FinancialDataScope = 'own' | 'firm';

/**
 * Check if a user role is BusinessOwner
 * @param role - The user's role
 * @returns true if the role is BusinessOwner
 */
export function isBusinessOwner(role: UserRole): boolean {
  return role === 'BusinessOwner';
}

/**
 * Check if a user has financial data access (Partner or BusinessOwner)
 * @param role - The user's role
 * @returns true if the role has financial data access
 */
export function hasFinancialAccess(role: UserRole): boolean {
  return role === 'Partner' || role === 'BusinessOwner';
}

/**
 * Get the financial data scope for a user role
 * @param role - The user's role
 * @returns 'firm' for BusinessOwner, 'own' for Partner, null for others
 */
export function getFinancialDataScopeForRole(role: UserRole): FinancialDataScope | null {
  if (role === 'BusinessOwner') {
    return 'firm';
  }
  if (role === 'Partner') {
    return 'own';
  }
  return null;
}

// Default Rates (Story 2.8.1)
export interface DefaultRates {
  partnerRate: number;    // USD per hour (in cents for precision)
  associateRate: number;  // USD per hour (in cents)
  paralegalRate: number;  // USD per hour (in cents)
}

// Custom Rates (Story 2.8.1)
export interface CustomRates {
  partnerRate?: number;
  associateRate?: number;
  paralegalRate?: number;
}

// Firm Entity (Story 2.8.1)
export interface Firm {
  id: string; // UUID
  name: string;
  defaultRates: DefaultRates | null;
  createdAt: Date;
  updatedAt: Date;
}

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

  // Billing fields (Story 2.8.1)
  billingType: BillingType;
  fixedAmount: number | null; // Required if billingType='Fixed', in cents
  customRates: CustomRates | null; // null = inherit from firm defaults

  // Retainer fields (Story 2.11.2)
  retainerAmount: number | null; // USD cents per period
  retainerPeriod: RetainerPeriod | null;
  retainerRollover: boolean;
  retainerAutoRenew: boolean;

  // Approval field (Story 2.8.2)
  approval?: CaseApproval; // Only present for cases requiring approval
}

// Retainer Configuration (Story 2.11.2)
export interface RetainerConfig {
  retainerAmount: number; // USD cents per period
  retainerPeriod: RetainerPeriod;
  retainerRollover: boolean;
  retainerAutoRenew: boolean;
}

// Retainer Usage tracking per period (Story 2.11.2)
export interface RetainerUsage {
  periodStart: Date;
  periodEnd: Date;
  hoursUsed: number;
  hoursIncluded: number;
  rolledOver: number;
  remaining: number;
  utilizationPercent: number;
}

// Retainer Period Usage record (Story 2.11.2)
export interface RetainerPeriodUsage {
  id: string; // UUID
  caseId: string; // UUID
  firmId: string; // UUID
  periodStart: Date;
  periodEnd: Date;
  hoursUsed: number;
  hoursIncluded: number;
  rolledOver: number;
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

// Case Audit Actions (Story 2.8.2)
export type CaseAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'ARCHIVED'
  | 'TEAM_ASSIGNED'
  | 'TEAM_REMOVED'
  | 'CASE_SUBMITTED_FOR_APPROVAL'  // Story 2.8.2
  | 'CASE_APPROVED'                // Story 2.8.2
  | 'CASE_REJECTED'                // Story 2.8.2
  | 'CASE_RESUBMITTED';            // Story 2.8.2

// Case Audit Log (tracks all case modifications)
export interface CaseAuditLog {
  id: string; // UUID
  caseId: string; // UUID
  userId: string | null; // UUID (User ID who made the change)
  action: string; // Use CaseAuditAction type for standard actions
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

// Case Rate History (Story 2.8.1)
export interface CaseRateHistory {
  id: string; // UUID
  caseId: string; // UUID
  changedAt: Date;
  changedBy: string; // UUID (User ID)
  rateType: RateType;
  oldRate: number; // In cents
  newRate: number; // In cents
  firmId: string; // UUID
}

// Case Approval (Story 2.8.2)
export interface CaseApproval {
  id: string; // UUID
  caseId: string; // UUID
  submittedBy: User; // User object (Associate who created case)
  submittedAt: Date;
  reviewedBy: User | null; // User object (Partner who reviewed)
  reviewedAt: Date | null;
  status: ApprovalStatus;
  rejectionReason: string | null; // Required if status='Rejected'
  revisionCount: number; // Increments each resubmit
  firmId?: string; // UUID (optional in GraphQL responses)
}

// Notification (Story 2.8.2)
export interface Notification {
  id: string; // UUID
  userId: string; // UUID
  type: NotificationType;
  title: string;
  message: string;
  link: string | null; // Deep link to case detail page
  read: boolean;
  caseId: string | null; // UUID (reference to related case)
  createdAt: Date;
  readAt: Date | null;
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
  firmId: string; // UUID - Required for firm isolation (Story 4.2)
  type: TaskType;
  title: string;
  description: string;
  assignedTo: string; // UUID (User ID)
  dueDate: Date;
  dueTime?: string; // HH:mm format (Story 4.2)
  status: 'Pending' | 'InProgress' | 'Completed' | 'Cancelled';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  estimatedHours?: number; // Story 4.2
  metadata: TaskMetadata;
  typeMetadata?: TaskTypeMetadata; // Type-specific metadata (Story 4.2)
  parentTaskId?: string; // UUID - For subtasks (Story 4.2)
  subtasks?: Task[]; // Child tasks (Story 4.2)
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date; // Story 4.2
}

// ============================================================================
// Story 2.8.4: Cross-Case Document Linking Types
// ============================================================================

// Client-Owned Document Entity (replaces case-owned Document)
// Documents are now owned by Client, not Case, allowing cross-case sharing
export interface ClientDocument {
  id: string; // UUID
  clientId: string; // UUID - Document owner
  firmId: string; // UUID - Firm isolation
  fileName: string;
  fileType: string; // MIME type or extension
  fileSize: number; // Size in bytes
  storagePath: string; // Storage path: /{firmId}/clients/{clientId}/documents/{documentId}-{fileName}
  uploadedBy: string; // UUID (User ID who uploaded)
  uploadedAt: Date;
  metadata: Record<string, unknown>; // Tags, description, etc.
  createdAt: Date;
  updatedAt: Date;
}

// Client Document with extended info for API responses
export interface ClientDocumentWithDetails extends ClientDocument {
  uploader: User; // Full user object
  client: Client; // Full client object
  linkedCases: CaseDocumentLink[]; // Cases this document is linked to
  originalCase?: Case | null; // Case where document was first uploaded
}

// Case-Document join table for many-to-many relationship
export interface CaseDocument {
  id: string; // UUID
  caseId: string; // UUID
  documentId: string; // UUID
  linkedBy: string; // UUID (User ID who linked)
  linkedAt: Date;
  isOriginal: boolean; // True if uploaded to this case, false if imported
  firmId: string; // UUID - Firm isolation
}

// Case-Document link with case details for API responses
export interface CaseDocumentLink {
  caseId: string; // UUID
  case: Case;
  linkedBy: User;
  linkedAt: Date;
  isOriginal: boolean;
}

// Document in case context (for case documents list)
export interface CaseDocumentWithDetails {
  document: ClientDocument;
  caseLink: CaseDocument;
  uploader: User;
  linker: User;
  sourceCase?: Case | null; // Case where document was originally uploaded (if imported)
}

// Document Audit Log entry
export interface DocumentAuditLogEntry {
  id: string; // UUID
  documentId: string | null; // Nullable for permanent delete
  userId: string; // UUID
  action: DocumentAuditAction;
  caseId: string | null; // Related case for link/unlink operations
  details: Record<string, unknown>; // fileName, affectedCaseCount, etc.
  timestamp: Date;
  firmId: string; // UUID
}

// Input types for GraphQL mutations
export interface LinkDocumentsInput {
  caseId: string; // UUID
  documentIds: string[]; // UUIDs - Multiple documents can be linked at once
}

// Document browser filter options
export interface DocumentBrowserFilters {
  search?: string;
  fileTypes?: string[];
  dateRange?: {
    from?: Date;
    to?: Date;
  };
}

// Document grouped by source case (for browser modal)
export interface DocumentsByCase {
  case: Case;
  documents: ClientDocumentWithDetails[];
}

// ============================================================================
// Story 5.4: Proactive AI Suggestions - User Preferences
// ============================================================================

/**
 * User preferences for AI and platform behavior
 * Stored as JSON in User.preferences field
 */
export interface UserPreferences {
  language: 'ro' | 'en';
  aiSuggestionLevel: 'aggressive' | 'moderate' | 'minimal';
  emailDigestFrequency: 'realtime' | 'hourly' | 'daily';
  dashboardLayout: Record<string, unknown>;
  timeZone: string;
}

// Factory override types for testing
export type UserOverrides = Partial<User>;
export type FirmOverrides = Partial<Firm>;
export type ClientOverrides = Partial<Client>;
export type CaseOverrides = Partial<Case>;
export type CaseTeamOverrides = Partial<CaseTeam>;
export type CaseTeamMemberOverrides = Partial<CaseTeamMember>;
export type CaseAuditLogOverrides = Partial<CaseAuditLog>;
export type CaseActorOverrides = Partial<CaseActor>;
export type CaseRateHistoryOverrides = Partial<CaseRateHistory>;
export type CaseApprovalOverrides = Partial<CaseApproval>; // Story 2.8.2
export type DocumentOverrides = Partial<Document>;
export type DocumentVersionOverrides = Partial<DocumentVersion>;
export type TaskOverrides = Partial<Task>;
export type ClientDocumentOverrides = Partial<ClientDocument>; // Story 2.8.4
export type CaseDocumentOverrides = Partial<CaseDocument>; // Story 2.8.4
export type DocumentAuditLogOverrides = Partial<DocumentAuditLogEntry>; // Story 2.8.4
