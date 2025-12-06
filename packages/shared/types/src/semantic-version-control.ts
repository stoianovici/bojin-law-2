/**
 * Semantic Version Control Types
 * Story 3.5: Semantic Version Control System
 *
 * Types for version comparison, semantic diff, and AI-powered change analysis
 */

// Change type classification
export enum ChangeType {
  ADDED = 'ADDED',
  REMOVED = 'REMOVED',
  MODIFIED = 'MODIFIED',
  MOVED = 'MOVED',
}

// Change significance levels
export enum ChangeSignificance {
  FORMATTING = 'FORMATTING',
  MINOR_WORDING = 'MINOR_WORDING',
  SUBSTANTIVE = 'SUBSTANTIVE',
  CRITICAL = 'CRITICAL',
}

// Risk levels for changes
export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

// Response suggestion types
export enum ResponseType {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
  COUNTER_PROPOSAL = 'COUNTER_PROPOSAL',
  CLARIFICATION = 'CLARIFICATION',
}

// Party role in document negotiation
export enum PartyRole {
  CLIENT = 'CLIENT',
  OPPOSING = 'OPPOSING',
}

// Legal change classification types
export enum LegalChangeType {
  TERM_MODIFICATION = 'TERM_MODIFICATION',
  OBLIGATION_CHANGE = 'OBLIGATION_CHANGE',
  PARTY_CHANGE = 'PARTY_CHANGE',
  DATE_CHANGE = 'DATE_CHANGE',
  AMOUNT_CHANGE = 'AMOUNT_CHANGE',
  LIABILITY_CHANGE = 'LIABILITY_CHANGE',
  TERMINATION_CHANGE = 'TERMINATION_CHANGE',
  FORCE_MAJEURE_CHANGE = 'FORCE_MAJEURE_CHANGE',
  PAYMENT_TERMS_CHANGE = 'PAYMENT_TERMS_CHANGE',
  SCOPE_CHANGE = 'SCOPE_CHANGE',
}

// Version control specific document context for AI analysis
export interface VersionControlDocumentContext {
  documentId: string;
  documentType: string;
  language: 'ro' | 'en';
  clientId?: string;
  caseId?: string;
  firmId: string;
}

// Parsed document section for comparison
export interface DocumentSection {
  id: string;
  path: string; // e.g., "1.2.3" or "Article I > Section 2"
  text: string;
  normalizedText: string;
  startOffset: number;
  endOffset: number;
}

// Individual change detected in semantic diff
export interface SemanticChange {
  id: string;
  changeType: ChangeType;
  significance: ChangeSignificance;
  beforeText: string;
  afterText: string;
  sectionPath?: string;
  plainSummary: string;
  legalClassification?: LegalChangeType;
  riskLevel?: RiskLevel;
  riskExplanation?: string;
  aiConfidence?: number;
  startOffset?: number;
  endOffset?: number;
}

// Semantic diff result
export interface SemanticDiffResult {
  documentId: string;
  fromVersionId: string;
  toVersionId: string;
  changes: SemanticChange[];
  totalChanges: number;
  changeBreakdown: ChangeBreakdown;
  computedAt: Date;
}

// Change count breakdown by significance
export interface ChangeBreakdown {
  formatting: number;
  minorWording: number;
  substantive: number;
  critical: number;
}

// Legal change with full classification
export interface LegalChange extends SemanticChange {
  legalClassification: LegalChangeType;
  impactDescription: string;
  affectedParties: string[];
  relatedClauses: string[];
}

// Response suggestion for a change
export interface ResponseSuggestion {
  id: string;
  changeId: string;
  suggestionType: ResponseType;
  suggestedText: string;
  reasoning?: string;
  language: 'ro' | 'en';
  createdAt: Date;
}

// Complete version comparison result
export interface VersionComparison {
  fromVersionId: string;
  toVersionId: string;
  fromVersionNumber: number;
  toVersionNumber: number;
  changes: SemanticChange[];
  executiveSummary: string;
  aggregateRisk: RiskLevel;
  totalChanges: number;
  changeBreakdown: ChangeBreakdown;
  comparedAt: Date;
}

// Version comparison cache entry
export interface VersionComparisonCache {
  id: string;
  fromVersionId: string;
  toVersionId: string;
  comparisonData: VersionComparison;
  summary: string;
  aggregateRisk: RiskLevel;
  createdAt: Date;
  expiresAt: Date;
}

// Document version with user info
export interface DocumentVersionInfo {
  id: string;
  documentId: string;
  versionNumber: number;
  oneDriveVersionId?: string;
  changesSummary?: string;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: Date;
  riskLevel?: RiskLevel;
}

// Version timeline with all versions
export interface VersionTimeline {
  documentId: string;
  versions: DocumentVersionInfo[];
  totalVersions: number;
}

// Semantic diff service input
export interface ComputeSemanticDiffInput {
  documentId: string;
  fromVersionId: string;
  toVersionId: string;
  documentContext: VersionControlDocumentContext;
}

// Change summary generation input
export interface GenerateChangeSummaryInput {
  diff: SemanticDiffResult;
  documentType: string;
  language: 'ro' | 'en';
}

// Risk assessment input
export interface AssessChangeRiskInput {
  change: LegalChange;
  documentContext: VersionControlDocumentContext;
}

// Response suggestion generation input
export interface GenerateResponseSuggestionsInput {
  changes: LegalChange[];
  partyRole: PartyRole;
  language: 'ro' | 'en';
  documentContext: VersionControlDocumentContext;
}

// Aggregate risk calculation result
export interface AggregateRiskResult {
  riskLevel: RiskLevel;
  explanation: string;
  contributingFactors: string[];
  highRiskChanges: string[]; // IDs of high-risk changes
}

// Rollback request
export interface RollbackVersionInput {
  documentId: string;
  targetVersionId: string;
  userId: string;
  reason?: string;
}

// Rollback result
export interface RollbackResult {
  success: boolean;
  newVersionId: string;
  newVersionNumber: number;
  message: string;
}
