/**
 * AI Training Pipeline Types
 * Story 3.2.6: AI Training Pipeline for Legacy Document Processing
 */

// ============================================================================
// Training Documents
// ============================================================================

export interface TrainingDocument {
  id: string;
  category: string;
  originalFilename: string;
  originalFolderPath?: string;
  oneDriveFileId: string;
  textContent: string;
  language: 'ro' | 'en';
  wordCount?: number;
  metadata?: TrainingDocumentMetadata;
  processedAt: Date;
  processingDurationMs?: number;
  createdAt: Date;
}

export interface TrainingDocumentMetadata {
  emailSubject?: string;
  emailSender?: string;
  emailDate?: Date;
  fileSize?: number;
  extractionMethod?: 'pdf-parse' | 'mammoth' | 'ocr';
}

// ============================================================================
// Document Embeddings
// ============================================================================

export interface DocumentEmbedding {
  id: string;
  documentId: string;
  chunkIndex: number;
  chunkText: string;
  embedding: number[]; // 1536-dimensional vector
  tokenCount?: number;
  createdAt: Date;
}

export interface EmbeddingSearchResult {
  documentId: string;
  chunkText: string;
  similarity: number;
  metadata?: TrainingDocumentMetadata;
}

// ============================================================================
// Document Patterns
// ============================================================================

export type PatternType = 'phrase' | 'clause' | 'structure';

export interface TrainingDocumentPattern {
  id: string;
  category: string;
  patternType: PatternType;
  patternText: string;
  frequency: number;
  documentIds: string[];
  confidenceScore?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Template Library
// ============================================================================

export interface TemplateStructure {
  sections: TemplateSection[];
  totalSections: number;
  avgSectionLength: number;
}

export interface TemplateSection {
  heading: string;
  order: number;
  commonPhrases: string[];
}

export interface DocumentTemplate {
  id: string;
  category: string;
  name?: string;
  baseDocumentId?: string;
  structure: TemplateStructure;
  similarDocumentIds: string[];
  usageCount: number;
  qualityScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Training Pipeline Runs
// ============================================================================

export type PipelineRunType = 'scheduled' | 'manual';
export type PipelineStatus = 'running' | 'completed' | 'failed';

export interface TrainingPipelineRun {
  id: string;
  runType: PipelineRunType;
  status: PipelineStatus;
  startedAt: Date;
  completedAt?: Date;
  documentsDiscovered: number;
  documentsProcessed: number;
  documentsFailed: number;
  patternsIdentified: number;
  templatesCreated: number;
  totalTokensUsed: number;
  errorLog?: PipelineErrorLog;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface PipelineErrorLog {
  errors: Array<{
    documentId?: string;
    fileName?: string;
    error: string;
    timestamp: Date;
  }>;
}

// ============================================================================
// Service Input/Output Types
// ============================================================================

export interface DiscoverDocumentsInput {
  categoryFolders: string[];
}

export interface DiscoverDocumentsOutput {
  newDocuments: Array<{
    oneDriveFileId: string;
    fileName: string;
    category: string;
    folderPath: string;
    metadata?: TrainingDocumentMetadata;
  }>;
  totalFound: number;
}

export interface ExtractTextInput {
  oneDriveFileId: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'doc';
}

export interface ExtractTextOutput {
  text: string;
  wordCount: number;
  language: 'ro' | 'en';
  extractionDurationMs: number;
}

export interface GenerateEmbeddingsInput {
  text: string;
  maxChunkTokens?: number;
}

export interface GenerateEmbeddingsOutput {
  chunks: Array<{
    index: number;
    text: string;
    embedding: number[];
    tokenCount: number;
  }>;
  totalTokensUsed: number;
}

export interface IdentifyPatternsInput {
  category: string;
  minFrequency?: number;
  minDocuments?: number;
}

export interface IdentifyPatternsOutput {
  patterns: TrainingDocumentPattern[];
  totalPatternsFound: number;
}

export interface ExtractTemplatesInput {
  category: string;
  similarityThreshold?: number;
}

export interface ExtractTemplatesOutput {
  templates: DocumentTemplate[];
  totalTemplatesCreated: number;
}

export interface SemanticSearchInput {
  query: string;
  category?: string;
  limit?: number;
  similarityThreshold?: number;
}

export interface SemanticSearchOutput {
  results: EmbeddingSearchResult[];
  totalResults: number;
}

// ============================================================================
// Pipeline Configuration
// ============================================================================

export interface TrainingPipelineConfig {
  batchSize: number; // Documents to process in parallel
  maxChunkTokens: number; // Max tokens per embedding chunk
  minPatternFrequency: number; // Minimum occurrences for pattern detection
  minPatternDocuments: number; // Minimum documents containing pattern
  templateSimilarityThreshold: number; // Cosine similarity threshold for templates
  retryAttempts: number; // Max retries for failed documents
  scheduleTime: string; // Cron expression for scheduled runs
}

export const DEFAULT_PIPELINE_CONFIG: TrainingPipelineConfig = {
  batchSize: 10,
  maxChunkTokens: 512,
  minPatternFrequency: 3,
  minPatternDocuments: 3,
  templateSimilarityThreshold: 0.85,
  retryAttempts: 3,
  scheduleTime: '0 2 * * *', // Daily at 2 AM
};
