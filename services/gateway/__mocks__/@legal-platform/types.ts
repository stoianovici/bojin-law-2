/**
 * Mock for @legal-platform/types
 * Used in Jest tests
 */

export const TASK_TYPE_VALIDATION_RULES = {
  Research: [
    { field: 'researchTopic', required: true, errorMessage: 'Research topic is required' },
  ],
  DocumentCreation: [
    { field: 'documentType', required: true, errorMessage: 'Document type is required' },
  ],
  DocumentRetrieval: [
    { field: 'documentDescription', required: true, errorMessage: 'Document description is required' },
  ],
  CourtDate: [
    { field: 'courtName', required: true, errorMessage: 'Court name is required' },
    { field: 'caseNumber', required: true, errorMessage: 'Court case number is required' },
    { field: 'hearingType', required: true, errorMessage: 'Hearing type is required' },
  ],
  Meeting: [
    { field: 'meetingType', required: true, errorMessage: 'Meeting type is required' },
  ],
  BusinessTrip: [
    { field: 'destination', required: true, errorMessage: 'Destination is required' },
    { field: 'purpose', required: true, errorMessage: 'Trip purpose is required' },
  ],
};

export const COURT_DATE_PREP_SUBTASKS = [
  { titleTemplate: 'Review case file for {hearingType}', daysBeforeHearing: 7, description: 'Complete review of all case documents and evidence' },
  { titleTemplate: 'Prepare exhibits for {hearingType}', daysBeforeHearing: 5, description: 'Organize and label all exhibits for presentation' },
  { titleTemplate: 'Draft outline/arguments for {hearingType}', daysBeforeHearing: 4, description: 'Prepare written outline of key arguments and responses' },
  { titleTemplate: 'Confirm witness availability', daysBeforeHearing: 3, description: 'Contact and confirm all witnesses will attend' },
  { titleTemplate: 'Final preparation review', daysBeforeHearing: 1, description: 'Final review of all materials and logistics' },
];

export type TaskType = 'Research' | 'DocumentCreation' | 'DocumentRetrieval' | 'CourtDate' | 'Meeting' | 'BusinessTrip';
