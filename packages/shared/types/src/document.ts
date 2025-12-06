/**
 * Document-related types for legacy import and AI analysis
 * Story 2.12.1 & 3.2.5
 */

export interface ExtractedDocument {
  id: string;
  fileName: string;
  folderPath: string;
  sessionId: string;
  extractedText?: string;
  emailMetadata?: {
    subject?: string;
    receivedDate?: string;
    sender?: string;
    recipients?: string[];
  };
  primaryLanguage?: string;
  secondaryLanguage?: string | null;
  languageRatio?: Record<string, number>;
  languageConfidence?: number;
  documentType?: string;
  documentTypeConfidence?: number;
  clauseCategories?: string[];
  templatePotential?: 'High' | 'Medium' | 'Low';
  aiMetadata?: {
    complexityScore?: number;
    structureType?: string;
    keyTerms?: Record<string, string[]>;
    clauseCount?: number;
  };
  riskIndicators?: {
    hasUnclearTerms?: boolean;
    hasMixedJurisdiction?: boolean;
    hasUnusualClauses?: boolean;
    complianceFlags?: string[];
  };
  aiAnalysisVersion?: string;
  analysisTimestamp?: Date;
}

export type SupportedLanguage = 'Romanian' | 'English' | 'Italian' | 'French' | 'Mixed';

export interface AIAnalysisResult {
  id: string;
  primaryLanguage: SupportedLanguage;
  secondaryLanguage: SupportedLanguage | null;
  languageRatio: Record<string, number>;
  languageConfidence: number;
  documentType: string;
  documentTypeConfidence: number;
  clauseCategories: string[];
  templatePotential: 'High' | 'Medium' | 'Low';
  keyTerms: {
    romanian: string[];
    english: string[];
  };
  complexityScore: number;
  structureType: 'structured' | 'semi-structured' | 'unstructured';
  riskIndicators: {
    hasUnclearTerms: boolean;
    hasMixedJurisdiction: boolean;
    hasUnusualClauses: boolean;
    complianceFlags: string[];
  };
}

// Document Type Discovery types
export interface DocumentTypeRegistryEntry {
  id: string;
  discoveredTypeOriginal: string;
  discoveredTypeNormalized: string;
  discoveredTypeEnglish?: string;
  primaryLanguage: string;
  documentCategory?: string;
  mappedSkillId?: string;
  mappedTemplateId?: string;
  mappingConfidence?: number;
  mappingStatus: 'pending' | 'auto_mapped' | 'manual_mapped' | 'template_created' | 'queue_review' | 'template_pending';
  firstSeenDate: Date;
  lastSeenDate: Date;
  totalOccurrences: number;
  uniqueVariations: number;
  avgDocumentLength?: number;
  frequencyScore?: number;
  complexityScore?: number;
  businessValueScore?: number;
  priorityScore?: number;
  sampleDocumentIds?: string[];
  commonClauses?: Record<string, any>;
  typicalStructure?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
}

export interface DiscoveryResult {
  registryEntry: DocumentTypeRegistryEntry;
  isNew: boolean;
  action: 'created' | 'updated' | 'threshold_reached';
  thresholdsMet?: {
    autoCreate: boolean;
    queueForReview: boolean;
    mapToExisting: boolean;
  };
  decision?: {
    action: 'auto_map' | 'queue_review' | 'create_template' | 'no_action';
    confidence: number;
    reason: string;
  };
}
