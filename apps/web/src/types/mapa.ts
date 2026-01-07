import type { Document, UserSummary } from './document';

// Slot status for document workflow
export type SlotStatus = 'pending' | 'requested' | 'received' | 'final';

// Document request status
export type DocumentRequestStatus =
  | 'pending'
  | 'sent'
  | 'reminded'
  | 'received'
  | 'expired'
  | 'cancelled';

// Mapa (Document Binder)
export interface Mapa {
  id: string;
  caseId: string;
  name: string;
  description?: string;
  templateId?: string;
  createdBy: UserSummary;
  createdAt: string;
  updatedAt: string;
  slots: MapaSlot[];
  completionStatus: MapaCompletionStatus;
}

// Document Request for a slot
export interface DocumentRequest {
  id: string;
  slotId: string;
  recipientEmail: string;
  recipientName?: string;
  status: DocumentRequestStatus;
  requestedAt: string;
  dueDate: string;
  remindersSent: number;
  lastReminderAt?: string;
}

// Mapa Slot
export interface MapaSlot {
  id: string;
  mapaId: string;
  name: string;
  description?: string;
  category: string;
  required: boolean;
  order: number;
  // Slot status for workflow tracking
  status: SlotStatus;
  // Assigned document (if filled)
  document?: Document;
  assignedAt?: string;
  assignedBy?: UserSummary;
  // Document request (if pending)
  documentRequest?: DocumentRequest;
}

// Slot status history entry for audit trail
export interface SlotStatusHistory {
  id: string;
  slotId: string;
  status: SlotStatus;
  changedAt: string;
  changedBy: UserSummary;
  note?: string;
}

// Completion tracking
export interface MapaCompletionStatus {
  totalSlots: number;
  filledSlots: number;
  requiredSlots: number;
  filledRequiredSlots: number;
  isComplete: boolean;
  missingRequired: string[]; // slot names
  percentComplete: number;
}

// AI analysis metadata for templates
export interface TemplateAIMetadata {
  enhanced: boolean;
  confidence?: number;
  legalContext?: string;
  warnings?: string[];
}

// Mapa Template (firm-scoped or ONRC)
export interface MapaTemplate {
  id: string;
  firmId: string | null; // null for ONRC system templates
  name: string;
  description?: string;
  caseType?: string;
  slotDefinitions: SlotDefinition[];
  isActive: boolean;
  usageCount: number;
  createdBy: UserSummary | null; // null for ONRC system templates
  createdAt?: string;
  updatedAt?: string;
  // ONRC sync fields
  isONRC?: boolean;
  isLocked?: boolean;
  sourceUrl?: string;
  lastSynced?: string;
  contentHash?: string;
  // Changelog for ONRC templates
  changelog?: TemplateChangelog[];
  // AI enhancement metadata
  aiMetadata?: TemplateAIMetadata;
}

// Template changelog entry
export interface TemplateChangelog {
  date: string;
  description: string;
  slotsAdded?: string[];
  slotsRemoved?: string[];
}

// Slot definition for templates
export interface SlotDefinition {
  name: string;
  description?: string;
  category?: string; // Optional for ONRC templates
  required: boolean;
  order: number;
}

// Case with mape for sidebar display
export interface CaseWithMape {
  id: string;
  caseNumber: string;
  name: string;
  status: 'Active' | 'PendingApproval' | 'OnHold' | 'Closed';
  documentCount: number;
  mape: Mapa[];
  unassignedDocumentCount: number;
}

// Calculate completion status from slots
export function calculateCompletionStatus(slots: MapaSlot[]): MapaCompletionStatus {
  const totalSlots = slots.length;
  const filledSlots = slots.filter((s) => s.document).length;
  const requiredSlots = slots.filter((s) => s.required).length;
  const filledRequiredSlots = slots.filter((s) => s.required && s.document).length;
  const missingRequired = slots.filter((s) => s.required && !s.document).map((s) => s.name);

  return {
    totalSlots,
    filledSlots,
    requiredSlots,
    filledRequiredSlots,
    isComplete: missingRequired.length === 0,
    missingRequired,
    percentComplete: totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0,
  };
}

// Mapa categories (Romanian legal terms)
export const mapaCategories = [
  // General categories
  { id: 'acte_procedurale', name: 'Acte Procedurale', nameEn: 'Procedural Documents' },
  { id: 'dovezi', name: 'Dovezi', nameEn: 'Evidence' },
  { id: 'corespondenta', name: 'Corespondență', nameEn: 'Correspondence' },
  { id: 'diverse', name: 'Diverse', nameEn: 'Miscellaneous' },
  // ONRC specific categories
  { id: 'formulare', name: 'Formulare', nameEn: 'Forms' },
  { id: 'acte_constitutive', name: 'Acte Constitutive', nameEn: 'Constitutional Documents' },
  { id: 'identitate', name: 'Identitate', nameEn: 'Identity Documents' },
  { id: 'declaratii', name: 'Declarații', nameEn: 'Declarations' },
  { id: 'sediu', name: 'Sediu Social', nameEn: 'Registered Office' },
  { id: 'financiar', name: 'Financiar', nameEn: 'Financial' },
  { id: 'hotarari', name: 'Hotărâri', nameEn: 'Decisions' },
  { id: 'certificate', name: 'Certificate', nameEn: 'Certificates' },
  { id: 'contracte', name: 'Contracte', nameEn: 'Contracts' },
  { id: 'taxe', name: 'Taxe și Tarife', nameEn: 'Fees and Tariffs' },
  // Special section for conditional documents (after "Dacă este cazul" header)
  { id: 'daca_este_cazul', name: 'Dacă Este Cazul', nameEn: 'If Applicable' },
] as const;

export type MapaCategoryId = (typeof mapaCategories)[number]['id'];

// Slot status display info
export const slotStatusInfo: Record<SlotStatus, { label: string; labelEn: string; color: string }> =
  {
    pending: { label: 'În așteptare', labelEn: 'Pending', color: 'gray' },
    requested: { label: 'Solicitat', labelEn: 'Requested', color: 'blue' },
    received: { label: 'Primit', labelEn: 'Received', color: 'green' },
    final: { label: 'Finalizat', labelEn: 'Final', color: 'emerald' },
  };

// Document request status display info
export const requestStatusInfo: Record<
  DocumentRequestStatus,
  { label: string; labelEn: string; color: string }
> = {
  pending: { label: 'În pregătire', labelEn: 'Pending', color: 'gray' },
  sent: { label: 'Trimis', labelEn: 'Sent', color: 'blue' },
  reminded: { label: 'Reminder trimis', labelEn: 'Reminded', color: 'orange' },
  received: { label: 'Primit', labelEn: 'Received', color: 'green' },
  expired: { label: 'Expirat', labelEn: 'Expired', color: 'red' },
  cancelled: { label: 'Anulat', labelEn: 'Cancelled', color: 'gray' },
};
