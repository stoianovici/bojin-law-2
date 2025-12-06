/**
 * Document Drafting Types
 * Story 3.3: Intelligent Document Drafting
 */

import type { AIOperationType } from './ai';
import type { DocumentType } from './entities';

// Re-export DocumentType for convenience
export type { DocumentType };

// Document-drafting specific template types (different from training-pipeline types)
export interface DraftTemplateStructure {
  sections: DraftTemplateSection[];
  metadata?: Record<string, unknown>;
}

export interface DraftTemplateSection {
  name: string;
  type: 'heading' | 'paragraph' | 'clause' | 'signature' | 'list';
  required: boolean;
  placeholder?: string;
}

// Context for document generation
export interface DocumentContext {
  caseId: string;
  case: CaseContext;
  client: ClientContext;
  teamMembers: TeamMemberContext[];
  relatedDocuments: RelatedDocumentContext[];
  firmContext?: FirmContext;
}

export interface CaseContext {
  id: string;
  caseNumber: string;
  title: string;
  type: string;
  status: string;
  description: string;
  openedDate: Date;
  closedDate?: Date;
  value?: number;
  metadata?: Record<string, unknown>;
}

export interface ClientContext {
  id: string;
  name: string;
  contactInfo: Record<string, unknown>;
  address?: string;
}

export interface TeamMemberContext {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface RelatedDocumentContext {
  id: string;
  title: string;
  type: string;
  summary?: string;
}

export interface FirmContext {
  id: string;
  name: string;
}

// Document generation input
export interface DocumentGenerationInput {
  caseId: string;
  prompt: string;
  documentType: DocumentType;
  templateId?: string;
  includeContext?: boolean;
  userId: string;
  firmId: string;
}

// Generated document output
export interface GeneratedDocument {
  id: string;
  title: string;
  content: string;
  suggestedTitle: string;
  templateUsed?: TemplateInfo;
  precedentsReferenced: PrecedentDocument[];
  tokensUsed: number;
  generationTimeMs: number;
}

export interface TemplateInfo {
  id: string;
  name: string;
  category: string;
}

// Precedent document from similarity search
export interface PrecedentDocument {
  documentId: string;
  title: string;
  similarity: number;
  relevantSections: string[];
  category?: string;
}

// Clause suggestion types
export enum ClauseSource {
  FirmPattern = 'FIRM_PATTERN',
  Template = 'TEMPLATE',
  AIGenerated = 'AI_GENERATED',
}

export interface ClauseSuggestion {
  id: string;
  text: string;
  source: ClauseSource;
  confidence: number;
  category: string;
}

export interface ClauseSuggestionRequest {
  documentId: string;
  documentType: DocumentType;
  currentText: string;
  cursorPosition: number;
  firmId: string;
  userId: string;
}

// Language explanation types
export interface LanguageExplanation {
  selection: string;
  explanation: string;
  legalBasis?: string;
  alternatives: string[];
}

export interface LanguageExplanationRequest {
  documentId: string;
  selectedText: string;
  documentContext?: string;
  firmId: string;
  userId: string;
}

// Template suggestion types
export interface TemplateSuggestion {
  id: string;
  name: string;
  category: string;
  structure: DraftTemplateStructure;
  usageCount: number;
  qualityScore: number;
}

// Quality metrics types
export interface DocumentDraftMetrics {
  id: string;
  documentId: string;
  initialWordCount: number;
  finalWordCount?: number;
  charactersAdded: number;
  charactersRemoved: number;
  editPercentage: number;
  timeToFinalizeMinutes?: number;
  userRating?: 1 | 2 | 3 | 4 | 5;
  createdAt: Date;
  updatedAt?: Date;
}

export interface QualityMetricsInput {
  documentId: string;
  initialContent: string;
  finalContent: string;
  startTime: Date;
  endTime?: Date;
  userRating?: 1 | 2 | 3 | 4 | 5;
}

export interface QualityMetricsSummary {
  averageEditPercentage: number;
  averageTimeToFinalize: number;
  averageUserRating: number;
  totalDocuments: number;
  byDocumentType: DocumentTypeMetrics[];
}

export interface DocumentTypeMetrics {
  documentType: DocumentType;
  averageEditPercentage: number;
  documentCount: number;
}

// Extend AIOperationType for document drafting operations
export const DocumentDraftingOperations = {
  DocumentGeneration: 'document_generation' as AIOperationType,
  ClauseSuggestion: 'clause_suggestion' as AIOperationType,
  LanguageExplanation: 'language_explanation' as AIOperationType,
  PrecedentSearch: 'precedent_search' as AIOperationType,
} as const;

// SSE event types for real-time suggestions
export interface SSEClauseSuggestionEvent {
  type: 'suggestion' | 'error' | 'heartbeat';
  data?: ClauseSuggestion;
  error?: string;
  timestamp: number;
}

// Search input types
export interface SimilarDocumentSearchInput {
  caseId: string;
  documentType: DocumentType;
  query?: string;
  limit?: number;
  firmId: string;
}

// Use SemanticSearchInput and SemanticSearchOutput from training-pipeline
// (already exported from the main types index via training-pipeline)
