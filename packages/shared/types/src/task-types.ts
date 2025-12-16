// Task Type System Types
// Story 4.2: Task Type System Implementation

import type { TaskType } from './entities';

// Type-specific metadata interfaces
export interface ResearchTaskMetadata {
  researchTopic: string;
  jurisdiction?: string;
  sources?: string[]; // URLs or references
  findings?: string;
}

export interface DocumentCreationTaskMetadata {
  documentType: string; // Contract, Motion, Letter, etc.
  templateId?: string;
  draftStatus?: 'NotStarted' | 'InProgress' | 'Review' | 'Complete';
  outputDocumentId?: string;
}

export interface DocumentRetrievalTaskMetadata {
  documentDescription: string;
  sourceLocation?: string; // Court, Client, Registry, etc.
  retrievalMethod?: 'Physical' | 'Electronic' | 'Request';
  trackingNumber?: string;
}

export interface CourtDateTaskMetadata {
  courtName: string;
  courtRoom?: string;
  caseNumber: string; // Court case number (may differ from internal)
  hearingType: string; // Hearing, Trial, Motion, etc.
  judge?: string;
  preparationNotes?: string;
  // Auto-generated subtask IDs
  preparationSubtaskIds?: string[];
}

export interface MeetingTaskMetadata {
  meetingType: 'Client' | 'Internal' | 'External' | 'CourtRelated';
  location?: string;
  virtualMeetingUrl?: string;
  agenda?: string;
  minutesDocumentId?: string;
}

export interface BusinessTripTaskMetadata {
  destination: string;
  purpose: string;
  travelDetails?: string;
  accommodationDetails?: string;
  delegationRequired: boolean;
  delegatedTasks?: string[]; // Task IDs being delegated
}

// Union type for all metadata
export type TaskTypeMetadata =
  | { type: 'Research'; data: ResearchTaskMetadata }
  | { type: 'DocumentCreation'; data: DocumentCreationTaskMetadata }
  | { type: 'DocumentRetrieval'; data: DocumentRetrievalTaskMetadata }
  | { type: 'CourtDate'; data: CourtDateTaskMetadata }
  | { type: 'Meeting'; data: MeetingTaskMetadata }
  | { type: 'BusinessTrip'; data: BusinessTripTaskMetadata };

// Validation rules per task type
export interface TaskTypeValidationRule {
  field: string;
  required: boolean;
  validation?: (value: unknown) => boolean;
  errorMessage: string;
}

// Enum validation helpers
const VALID_MEETING_TYPES = ['Client', 'Internal', 'External', 'CourtRelated'] as const;
const VALID_DRAFT_STATUSES = ['NotStarted', 'InProgress', 'Review', 'Complete'] as const;
const VALID_RETRIEVAL_METHODS = ['Physical', 'Electronic', 'Request'] as const;

export const TASK_TYPE_VALIDATION_RULES: Record<TaskType, TaskTypeValidationRule[]> = {
  Research: [
    { field: 'researchTopic', required: true, errorMessage: 'Research topic is required' },
  ],
  DocumentCreation: [
    { field: 'documentType', required: true, errorMessage: 'Document type is required' },
    {
      field: 'draftStatus',
      required: false,
      validation: (value: unknown) =>
        value === undefined || VALID_DRAFT_STATUSES.includes(value as any),
      errorMessage: 'Draft status must be one of: NotStarted, InProgress, Review, Complete',
    },
  ],
  DocumentRetrieval: [
    {
      field: 'documentDescription',
      required: true,
      errorMessage: 'Document description is required',
    },
    {
      field: 'retrievalMethod',
      required: false,
      validation: (value: unknown) =>
        value === undefined || VALID_RETRIEVAL_METHODS.includes(value as any),
      errorMessage: 'Retrieval method must be one of: Physical, Electronic, Request',
    },
  ],
  CourtDate: [
    { field: 'courtName', required: true, errorMessage: 'Court name is required' },
    { field: 'caseNumber', required: true, errorMessage: 'Court case number is required' },
    { field: 'hearingType', required: true, errorMessage: 'Hearing type is required' },
  ],
  Meeting: [
    {
      field: 'meetingType',
      required: true,
      validation: (value: unknown) => VALID_MEETING_TYPES.includes(value as any),
      errorMessage: 'Meeting type must be one of: Client, Internal, External, CourtRelated',
    },
  ],
  BusinessTrip: [
    { field: 'destination', required: true, errorMessage: 'Destination is required' },
    { field: 'purpose', required: true, errorMessage: 'Trip purpose is required' },
  ],
};

// Court date preparation subtask templates
export interface CourtDatePrepSubtask {
  titleTemplate: string;
  daysBeforeHearing: number;
  description: string;
}

export const COURT_DATE_PREP_SUBTASKS: CourtDatePrepSubtask[] = [
  {
    titleTemplate: 'Review case file for {hearingType}',
    daysBeforeHearing: 7,
    description: 'Complete review of all case documents and evidence',
  },
  {
    titleTemplate: 'Prepare exhibits for {hearingType}',
    daysBeforeHearing: 5,
    description: 'Organize and label all exhibits for presentation',
  },
  {
    titleTemplate: 'Draft outline/arguments for {hearingType}',
    daysBeforeHearing: 4,
    description: 'Prepare written outline of key arguments and responses',
  },
  {
    titleTemplate: 'Confirm witness availability',
    daysBeforeHearing: 3,
    description: 'Contact and confirm all witnesses will attend',
  },
  {
    titleTemplate: 'Final preparation review',
    daysBeforeHearing: 1,
    description: 'Final review of all materials and logistics',
  },
];
