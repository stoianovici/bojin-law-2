/**
 * AI Service Types
 * Story 3.1: AI Service Infrastructure
 */

// Task complexity levels for model routing
export enum TaskComplexity {
  Simple = 'simple', // < 1000 tokens, classification, extraction
  Standard = 'standard', // General document work
  Complex = 'complex', // Legal analysis, multi-document reasoning
}

// Claude model identifiers
export enum ClaudeModel {
  Haiku = 'claude-3-haiku-20240307',
  Sonnet = 'claude-3-5-sonnet-20241022',
  Opus = 'claude-3-opus-20240229',
}

// Provider status for health monitoring
export enum ProviderStatus {
  Healthy = 'HEALTHY',
  Degraded = 'DEGRADED',
  Unavailable = 'UNAVAILABLE',
}

// Circuit breaker states
export enum CircuitState {
  Closed = 'closed', // Normal operation
  Open = 'open', // Failing, rejecting requests
  HalfOpen = 'half-open', // Testing recovery
}

// AI operation types for tracking
export enum AIOperationType {
  TextGeneration = 'text_generation',
  DocumentSummary = 'document_summary',
  LegalAnalysis = 'legal_analysis',
  Classification = 'classification',
  Extraction = 'extraction',
  Embedding = 'embedding',
  Chat = 'chat',
  // Story 3.6: Document Review
  DocumentReviewAnalysis = 'document_review_analysis',
  // Story 4.1: Natural Language Task Parser
  TaskParsing = 'task_parsing',
  // Story 5.2: Communication Intelligence
  CommunicationIntelligence = 'communication_intelligence',
  RiskAnalysis = 'risk_analysis',
  ThreadAnalysis = 'thread_analysis',
  // Story 5.4: Proactive AI Suggestions
  ProactiveSuggestion = 'proactive_suggestion',
  MorningBriefing = 'morning_briefing',
  PatternRecognition = 'pattern_recognition',
  DocumentCompleteness = 'document_completeness',
}

// Generation request input
export interface AIGenerateRequest {
  prompt: string;
  systemPrompt?: string;
  context?: string;
  operationType: AIOperationType;
  complexity?: TaskComplexity;
  modelOverride?: ClaudeModel;
  maxTokens?: number;
  temperature?: number;
  userId?: string;
  caseId?: string;
  firmId: string;
}

// Generation response
export interface AIGenerateResponse {
  content: string;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costCents: number;
  latencyMs: number;
  cached: boolean;
  cacheKey?: string;
}

// Embedding request
export interface AIEmbedRequest {
  text: string;
  firmId: string;
}

// Embedding response
export interface AIEmbedResponse {
  embedding: number[];
  model: string;
  inputTokens: number;
}

// Token usage record
export interface AITokenUsageRecord {
  id: string;
  userId?: string;
  caseId?: string;
  firmId: string;
  operationType: AIOperationType;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costCents: number;
  latencyMs: number;
  cached: boolean;
  createdAt: Date;
}

// Cache entry
export interface AICacheEntry {
  id: string;
  promptHash: string;
  promptEmbedding?: number[];
  prompt: string;
  response: string;
  modelUsed: string;
  operationType: AIOperationType;
  firmId: string;
  hitCount: number;
  createdAt: Date;
  expiresAt: Date;
}

// Provider health status
export interface AIProviderHealth {
  provider: string;
  status: ProviderStatus;
  latencyMs: number;
  lastChecked: Date;
  errorRate?: number;
  consecutiveFailures?: number;
}

// Usage statistics
export interface AIUsageStats {
  totalTokens: number;
  totalCostCents: number;
  requestCount: number;
  avgLatencyMs: number;
  cacheHitRate: number;
  byModel: AIModelUsage[];
  byOperation: AIOperationUsage[];
}

// Usage by model
export interface AIModelUsage {
  model: string;
  tokens: number;
  costCents: number;
  requestCount: number;
}

// Usage by operation
export interface AIOperationUsage {
  operation: AIOperationType;
  tokens: number;
  costCents: number;
  requestCount: number;
}

// Date range for AI queries
export interface AIDateRange {
  start: Date;
  end: Date;
}

// Model pricing (per 1M tokens in cents)
export interface ModelPricing {
  input: number;
  output: number;
}

// Circuit breaker configuration
export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
}
