/**
 * API Client for Word Add-in
 * Story 3.4: Word Integration with Live AI Assistance - Task 14
 *
 * Handles API calls to the backend AI service.
 */

import { getAccessToken } from './auth';
import {
  isDebugMode,
  CAPTURE_MODE,
  MOCK_KEY,
  captureResponse,
  streamMockResponse,
} from './debug-mock';
import { createStreamCleanup, createStreamContext } from './stream-utils';

// ============================================================================
// Types imported from shared package (replicated for standalone add-in)
// ============================================================================

/** Template metadata passed to backend for AI-guided generation */
interface CourtFilingTemplateMetadata {
  name: string;
  cpcArticles: string[];
  partyLabels: { party1: string; party2: string; party3?: string };
  requiredSections: string[];
  formCategory: 'A' | 'B' | 'C';
  category?: string;
  description?: string;
}

/** Validation result for court filing documents */
interface CourtFilingValidationResult {
  valid: boolean;
  missingSections: string[];
  foundSections: string[];
  warnings?: string[];
}

/** Progress event for streaming updates */
interface WordProgressEvent {
  type:
    | 'phase_start'
    | 'phase_complete'
    | 'search'
    | 'thinking'
    | 'writing'
    | 'formatting'
    | 'error';
  phase?: 'research' | 'writing' | 'formatting';
  text: string;
  progress?: number;
  query?: string;
  partialContent?: string;
  tool?: string;
  input?: Record<string, unknown>;
  retrying?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum buffer size for streaming responses (10MB) */
const MAX_BUFFER_SIZE = 10 * 1024 * 1024;

/** Streaming timeout (5 minutes - balanced for multi-agent research tasks) */
const STREAM_TIMEOUT_MS = 5 * 60 * 1000;

// Configuration - use current origin for API calls
// This works for all setups:
// - Local dev: localhost:3005 → proxied to localhost:4000 via vite
// - Tunnel: dev.bojin-law.com → same origin
// - Production: api.bojin-law.com → same origin
const API_BASE_URL = (() => {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    // Use current origin for bojin-law.com domains OR localhost (proxy setup)
    if (origin.includes('bojin-law.com') || origin.includes('localhost')) {
      return origin;
    }
  }
  return import.meta.env.VITE_API_BASE_URL || 'https://localhost:4000';
})();

// Log API configuration on load (helps debug production issues)
console.log('[ApiClient] Initialized with API_BASE_URL:', API_BASE_URL);
console.log('[ApiClient] Environment mode:', import.meta.env.MODE);
console.log('[ApiClient] Dev bypass:', import.meta.env.VITE_DEV_BYPASS);

// Types
interface SuggestionRequest {
  documentId?: string;
  selectedText: string;
  cursorContext: string;
  suggestionType: 'completion' | 'alternative' | 'precedent';
  caseId?: string;
  customInstructions?: string;
  premiumMode?: boolean;
}

interface Suggestion {
  id: string;
  type: 'completion' | 'alternative' | 'precedent';
  content: string;
  confidence: number;
  source?: string;
  reasoning?: string;
}

interface SuggestionResponse {
  suggestions: Suggestion[];
  processingTimeMs: number;
}

interface ExplainRequest {
  documentId?: string;
  selectedText: string;
  caseId?: string;
  customInstructions?: string;
  premiumMode?: boolean;
}

interface ExplainResponse {
  explanation: string;
  legalBasis?: string;
  sourceReferences?: string[];
  processingTimeMs: number;
}

interface ImproveRequest {
  documentId?: string;
  selectedText: string;
  improvementType: 'clarity' | 'formality' | 'brevity' | 'legal_precision';
  caseId?: string;
  customInstructions?: string;
  premiumMode?: boolean;
}

interface DraftRequest {
  contextType: 'case' | 'client' | 'internal';
  caseId?: string;
  clientId?: string;
  documentName: string;
  prompt: string;
  existingContent?: string;
  /** Explicit toggle to enable web search for research documents */
  enableWebSearch?: boolean;
  /** Use two-phase research architecture for better academic quality */
  useTwoPhaseResearch?: boolean;
  /** Use multi-agent fan-out/fan-in architecture for parallel section generation */
  useMultiAgent?: boolean;
  /** Source types for research documents: legislation, jurisprudence, doctrine, comparative */
  sourceTypes?: ('legislation' | 'jurisprudence' | 'doctrine' | 'comparative')[];
  /** Research depth: 'quick' for superficial, 'deep' for thorough (aprofundată) */
  researchDepth?: 'quick' | 'deep';
  /** Enable premium mode for enhanced AI processing (Opus model) */
  premiumMode?: boolean;
}

interface DraftResponse {
  content: string;
  /** OOXML fragment for style-aware insertion via Word's insertOoxml() API */
  ooxmlContent?: string;
  title: string;
  tokensUsed: number;
  processingTimeMs: number;
}

interface DraftFromTemplateRequest {
  templateId: string;
  caseId: string;
  customInstructions?: string;
  placeholderValues?: Record<string, string>;
}

interface DraftFromTemplateResponse {
  content: string;
  /** OOXML fragment for style-aware insertion via Word's insertOoxml() API */
  ooxmlContent?: string;
  title: string;
  templateUsed: { id: string; name: string };
  tokensUsed: number;
  processingTimeMs: number;
}

interface WordTemplate {
  id: string;
  name: string;
  description?: string;
  caseType?: string;
  documentType: string;
  category?: string;
  tags: string[];
  usageCount: number;
}

interface CourtFilingTemplate {
  id: string;
  name: string;
  description: string;
  category: 'faza-initiala' | 'interventii' | 'cai-atac' | 'executare' | 'speciale';
  formCategory: 'A' | 'B' | 'C';
  cpcArticles: string[];
  partyLabels: { party1: string; party2: string; party3?: string };
  requiredSections: string[];
  keywords: string[];
}

interface CourtFilingGenerateRequest {
  templateId: string;
  contextType: 'case' | 'client' | 'internal';
  caseId?: string;
  clientId?: string;
  instructions?: string;
  includeOoxml?: boolean;
  /** Template metadata for AI-guided generation */
  templateMetadata?: CourtFilingTemplateMetadata;
}

interface CourtFilingGenerateResponse {
  content: string;
  ooxmlContent?: string;
  title: string;
  template: {
    id: string;
    name: string;
    category: string;
    formCategory: string;
  };
  tokensUsed: number;
  processingTimeMs: number;
  /** Validation result - warns about missing required sections */
  validation?: CourtFilingValidationResult;
}

interface ContextFile {
  caseId: string;
  profileCode: string;
  content: string;
  tokenCount: number;
  version: number;
  generatedAt: string;
}

interface ActiveCase {
  id: string;
  title: string;
  caseNumber: string;
}

interface ActiveClient {
  id: string;
  name: string;
  type: 'Individual' | 'Company';
  cases?: { id: string; title: string }[];
}

interface ImproveResponse {
  original: string;
  improved: string;
  /** OOXML fragment for style-aware insertion via Word's insertOoxml() API */
  ooxmlContent?: string;
  explanation: string;
  processingTimeMs: number;
}

// ============================================================================
// Contract Analysis Types
// ============================================================================

interface ContractAnalysisRequest {
  documentContent: string;
  caseId?: string;
  clientId?: string;
  premiumMode: true; // Always true for contract analysis
}

interface ClauseAnalysis {
  id: string;
  clauseReference: string; // e.g., "Art. 5.2"
  clauseText: string;
  riskLevel: 'high' | 'medium' | 'low';
  reasoning: string;
  alternatives: Array<{
    id: string;
    label: string; // e.g., "Conservator", "Echilibrat", "Agresiv"
    description: string;
    text: string;
  }>;
  cpcArticles: string[];
}

interface ContractAnalysisResponse {
  clauses: ClauseAnalysis[];
  clarifyingQuestions?: Array<{
    id: string;
    question: string;
    options: Array<{ id: string; label: string; description: string }>;
  }>;
  summary: {
    totalClauses: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
  thinkingBlocks?: string[]; // AI reasoning blocks for PanouRaționament
  processingTimeMs: number;
}

interface ClauseResearchRequest {
  clauseText: string;
  issue: string;
  caseId?: string;
}

interface ClauseResearchResponse {
  legislation: Array<{ title: string; article: string; relevance: string }>;
  jurisprudence: Array<{ court: string; decision: string; summary: string }>;
  analysis: string;
  processingTimeMs: number;
}

// ============================================================================
// Edit Mode Types
// ============================================================================

/** Context for edit requests */
interface EditContext {
  type: 'selection' | 'document';
  selectedText?: string;
  documentContent?: string;
  cursorPosition?: number;
}

/** Request for edit endpoint */
interface EditRequest {
  context: EditContext;
  conversation: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  prompt: string;
  /** Case ID for context-aware editing */
  caseId?: string;
}

/** A single change to apply to the document */
interface EditChange {
  type: 'replace' | 'insert' | 'delete';
  originalText?: string;
  newText: string;
  ooxmlContent?: string;
  location?: 'selection' | 'after_selection' | { searchText: string };
}

/** Response from edit endpoint */
interface EditResponse {
  changes: EditChange[];
  message: string;
}

/** Citation from jurisprudence research */
interface JurisprudenceCitation {
  id: string;
  decisionType: 'decizie' | 'sentință' | 'încheiere';
  decisionNumber: string;
  court: string;
  courtFull: string;
  section?: string;
  date: string;
  dateFormatted: string;
  url: string;
  caseNumber?: string;
  summary: string;
  relevance: string;
  officialGazette?: string;
}

/** Result from jurisprudence research */
interface JurisprudenceResearchResult {
  success: boolean;
  output?: {
    topic: string;
    generatedAt: string;
    citations: JurisprudenceCitation[];
    analysis: string;
    gaps: string[];
    metadata: {
      searchCount: number;
      sourcesSearched: string[];
      durationMs: number;
      costEur: number;
    };
  };
  error?: string;
  durationMs: number;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  costEur?: number;
}

/**
 * API Client class
 */
class ApiClient {
  /**
   * Get AI suggestions for text
   */
  async getSuggestions(request: SuggestionRequest): Promise<SuggestionResponse> {
    return this.post<SuggestionResponse>(`${API_BASE_URL}/api/ai/word/suggest`, request);
  }

  /**
   * Explain legal text
   */
  async explainText(request: ExplainRequest): Promise<ExplainResponse> {
    return this.post<ExplainResponse>(`${API_BASE_URL}/api/ai/word/explain`, request);
  }

  /**
   * Improve text
   */
  async improveText(request: ImproveRequest): Promise<ImproveResponse> {
    return this.post<ImproveResponse>(`${API_BASE_URL}/api/ai/word/improve`, request);
  }

  /**
   * Draft document content based on case context and user prompt
   */
  async draft(request: DraftRequest): Promise<DraftResponse> {
    return this.post<DraftResponse>(`${API_BASE_URL}/api/ai/word/draft`, request);
  }

  /**
   * Draft document content with streaming response.
   * Uses Server-Sent Events to receive text chunks in real-time.
   *
   * @param request - Draft request parameters
   * @param onChunk - Callback for each text chunk received
   * @param onProgress - Callback for progress events (tool usage, thinking)
   * @returns Final draft response with OOXML content
   */
  async draftStream(
    request: DraftRequest,
    onChunk: (chunk: string) => void,
    onProgress?: (event: {
      type: string;
      tool?: string;
      input?: Record<string, unknown>;
      text?: string;
    }) => void
  ): Promise<DraftResponse> {
    // DEBUG MODE: Use mock data instead of real API
    if (isDebugMode()) {
      console.log('[ApiClient] DEBUG_MODE enabled - using mock data');
      const progressFn = onProgress || (() => {});
      const mockResponse = await streamMockResponse(MOCK_KEY, onChunk, progressFn);
      return {
        content: mockResponse.content,
        title: mockResponse.title,
        tokensUsed: mockResponse.tokensUsed,
        processingTimeMs: mockResponse.processingTimeMs,
      };
    }

    console.log('[ApiClient] draftStream starting...', {
      url: `${API_BASE_URL}/api/ai/word/draft/stream`,
      contextType: request.contextType,
      documentName: request.documentName,
    });

    return new Promise((resolve, reject) => {
      // Create stream context and cleanup function using shared utility
      const ctx = createStreamContext();
      const cleanup = createStreamCleanup(ctx, reject);

      // Timeout after 5 minutes (balanced for multi-agent research tasks)
      ctx.timeoutId = setTimeout(() => {
        console.error('[ApiClient] draftStream timeout after 5 minutes');
        cleanup(new Error('Request timeout - generation took too long'));
      }, STREAM_TIMEOUT_MS);

      // Use fetch with SSE for streaming
      // Note: mode/credentials explicitly set for Office iframe sandbox compatibility
      fetch(`${API_BASE_URL}/api/ai/word/draft/stream`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(request),
        mode: 'cors',
        credentials: 'omit', // Avoid CORS complexity - auth is via Bearer token
      })
        .then(async (response) => {
          console.log(
            '[ApiClient] draftStream response received:',
            response.status,
            response.statusText
          );

          if (!response.ok) {
            cleanup();
            const errorData = await response.json().catch(() => ({}));
            console.error('[ApiClient] draftStream error response:', errorData);
            reject(new Error(errorData.message || `Request failed: ${response.status}`));
            return;
          }

          ctx.reader = response.body?.getReader() || null;
          if (!ctx.reader) {
            cleanup(new Error('No response body'));
            return;
          }

          const decoder = new TextDecoder();
          let buffer = '';
          // Track event type across processBuffer calls (fix for chunked SSE delivery)
          let eventType = '';

          const processBuffer = () => {
            // Check buffer size to prevent memory exhaustion
            if (ctx.accumulatedContent.length > MAX_BUFFER_SIZE) {
              cleanup(new Error(`Response too large (max ${MAX_BUFFER_SIZE / 1024 / 1024}MB)`));
              return false;
            }

            // Process complete SSE events in buffer
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                const data = line.slice(5).trim();
                if (!data) continue;

                try {
                  if (eventType === 'chunk') {
                    // Parse the JSON-escaped chunk and call the callback
                    const chunk = JSON.parse(data);
                    ctx.accumulatedContent += chunk;
                    onChunk(chunk);
                  } else if (eventType === 'progress') {
                    // Progress event (tool usage, thinking)
                    if (onProgress) {
                      const progressEvent = JSON.parse(data);
                      onProgress(progressEvent);
                    }
                  } else if (eventType === 'done') {
                    // Final metadata - OOXML is fetched separately via REST
                    const metadata = JSON.parse(data);
                    console.log('[ApiClient] draftStream completed successfully');

                    const result = {
                      content: ctx.accumulatedContent,
                      title: metadata.title,
                      tokensUsed: metadata.tokensUsed,
                      processingTimeMs: metadata.processingTimeMs,
                    };

                    // CAPTURE MODE: Log response for debugging
                    if (CAPTURE_MODE) {
                      captureResponse(result, request.documentName);
                    }

                    cleanup(); // Clear timeout and resources
                    resolve(result);
                  } else if (eventType === 'error') {
                    const errorData = JSON.parse(data);
                    console.error('[ApiClient] draftStream SSE error event:', errorData);
                    // Defensive parsing - handle various error shapes
                    const errorMessage =
                      typeof errorData === 'string'
                        ? errorData
                        : errorData?.error || errorData?.message || 'Streaming error';
                    cleanup(new Error(errorMessage));
                  }
                } catch (e) {
                  console.warn('Failed to parse SSE data:', e);
                }
              }
            }
            return true;
          };

          try {
            while (true) {
              const { done, value } = await ctx.reader!.read();

              // Process any data received (even on final read)
              if (value) {
                buffer += decoder.decode(value, { stream: true });
                if (!processBuffer()) {
                  return; // Buffer check failed, cleanup already called
                }
              }

              if (done) {
                // Process any remaining data with flush
                buffer += decoder.decode(new Uint8Array(), { stream: false });
                if (buffer.trim()) {
                  buffer += '\n'; // Ensure final line is processed
                  processBuffer();
                }
                break;
              }
            }
          } catch (readError) {
            cleanup(readError instanceof Error ? readError : new Error('Read error'));
          }
        })
        .catch((err) => {
          cleanup();
          // Log network-level errors with full details
          console.error('[ApiClient] draftStream fetch error:', err);
          console.error('[ApiClient] Error type:', err?.constructor?.name);
          console.error('[ApiClient] Error message:', err?.message);
          console.error('[ApiClient] API URL was:', `${API_BASE_URL}/api/ai/word/draft/stream`);
          reject(err);
        });
    });
  }

  /**
   * Research jurisprudence via dedicated agent.
   * Produces properly formatted Romanian court citations.
   *
   * @param topic - The legal topic to research
   * @param context - Optional additional context
   * @param caseId - Optional case ID for context
   * @param onProgress - Progress callback for UI updates
   */
  async jurisprudenceResearch(
    topic: string,
    context?: string,
    caseId?: string,
    onProgress?: (event: { type: string; message: string; data?: unknown }) => void
  ): Promise<JurisprudenceResearchResult> {
    console.log('[ApiClient] jurisprudenceResearch starting...', {
      url: `${API_BASE_URL}/api/ai/word/research/jurisprudence`,
      topic: topic.slice(0, 100),
      hasContext: !!context,
      caseId,
    });

    return new Promise((resolve, reject) => {
      const ctx = createStreamContext();
      const cleanup = createStreamCleanup(ctx, reject);

      // Timeout after 5 minutes
      ctx.timeoutId = setTimeout(() => {
        console.error('[ApiClient] jurisprudenceResearch timeout after 5 minutes');
        cleanup(new Error('Request timeout - research took too long'));
      }, STREAM_TIMEOUT_MS);

      fetch(`${API_BASE_URL}/api/ai/word/research/jurisprudence`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ topic, context, caseId }),
        mode: 'cors',
        credentials: 'omit',
      })
        .then(async (response) => {
          console.log(
            '[ApiClient] jurisprudenceResearch response received:',
            response.status,
            response.statusText
          );

          if (!response.ok) {
            cleanup();
            const errorData = await response.json().catch(() => ({}));
            console.error('[ApiClient] jurisprudenceResearch error response:', errorData);
            reject(new Error(errorData.message || `Request failed: ${response.status}`));
            return;
          }

          ctx.reader = response.body?.getReader() || null;
          if (!ctx.reader) {
            cleanup(new Error('No response body'));
            return;
          }

          const decoder = new TextDecoder();
          let buffer = '';
          let eventType = '';

          const processBuffer = () => {
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                const data = line.slice(5).trim();
                if (!data) continue;

                try {
                  if (eventType === 'start') {
                    const startData = JSON.parse(data);
                    console.log('[ApiClient] jurisprudenceResearch started:', startData);
                  } else if (eventType === 'progress') {
                    if (onProgress) {
                      const progressEvent = JSON.parse(data);
                      onProgress(progressEvent);
                    }
                  } else if (eventType === 'complete') {
                    const result = JSON.parse(data);
                    console.log('[ApiClient] jurisprudenceResearch completed:', {
                      success: result.success,
                      citationCount: result.output?.citations?.length,
                    });
                    cleanup();
                    resolve(result);
                  } else if (eventType === 'error') {
                    const errorData = JSON.parse(data);
                    console.error('[ApiClient] jurisprudenceResearch error:', errorData);
                    cleanup(new Error(errorData.error || 'Research failed'));
                  }
                } catch (e) {
                  console.warn('Failed to parse SSE data:', e);
                }
              }
            }
            return true;
          };

          try {
            while (true) {
              const { done, value } = await ctx.reader!.read();

              if (value) {
                buffer += decoder.decode(value, { stream: true });
                if (!processBuffer()) return;
              }

              if (done) {
                // Process any remaining data
                buffer += decoder.decode();
                processBuffer();
                break;
              }
            }
          } catch (readError) {
            cleanup(readError instanceof Error ? readError : new Error('Read error'));
          }
        })
        .catch((err) => {
          cleanup();
          console.error('[ApiClient] jurisprudenceResearch fetch error:', err);
          reject(err);
        });
    });
  }

  /**
   * Convert content to OOXML via REST endpoint.
   * Used after streaming to get formatted content for Word insertion.
   *
   * @param content - The content to convert
   * @param format - 'html' for research documents (default), 'markdown' for contracts
   * @param options - Optional metadata for cover page
   */
  async getOoxml(
    content: string,
    format: 'html' | 'markdown' = 'html',
    options?: {
      title?: string;
      subtitle?: string;
    }
  ): Promise<{ ooxmlContent: string }> {
    const body = {
      ...(format === 'html' ? { html: content } : { markdown: content }),
      title: options?.title,
      subtitle: options?.subtitle,
    };
    return this.post<{ ooxmlContent: string }>(`${API_BASE_URL}/api/ai/word/ooxml`, body);
  }

  /**
   * Get case context for AI
   */
  async getCaseContext(caseId: string): Promise<ContextFile> {
    return this.get<ContextFile>(`${API_BASE_URL}/api/ai/word/context/${caseId}`);
  }

  /**
   * Get available templates
   */
  async getTemplates(params?: {
    caseType?: string;
    documentType?: string;
  }): Promise<{ templates: WordTemplate[] }> {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return this.get<{ templates: WordTemplate[] }>(
      `${API_BASE_URL}/api/ai/word/templates${query ? `?${query}` : ''}`
    );
  }

  /**
   * Draft document from template
   */
  async draftFromTemplate(request: DraftFromTemplateRequest): Promise<DraftFromTemplateResponse> {
    return this.post<DraftFromTemplateResponse>(
      `${API_BASE_URL}/api/ai/word/draft-from-template`,
      request
    );
  }

  /**
   * Get court filing templates
   */
  async getCourtFilingTemplates(): Promise<{ templates: CourtFilingTemplate[] }> {
    return this.get<{ templates: CourtFilingTemplate[] }>(
      `${API_BASE_URL}/api/ai/word/court-filing-templates`
    );
  }

  /**
   * Generate a court filing document from template
   */
  async generateCourtFiling(
    request: CourtFilingGenerateRequest
  ): Promise<CourtFilingGenerateResponse> {
    return this.post<CourtFilingGenerateResponse>(
      `${API_BASE_URL}/api/ai/word/court-filing/generate`,
      request
    );
  }

  /**
   * Generate a court filing document with streaming response.
   * Prevents timeout on long-running generation by using SSE with keepalive.
   *
   * @param request - Court filing generation request
   * @param onChunk - Callback for each text chunk received
   * @param onProgress - Callback for progress events (tool usage, thinking)
   */
  async generateCourtFilingStream(
    request: Omit<CourtFilingGenerateRequest, 'includeOoxml'>,
    onChunk: (chunk: string) => void,
    onProgress?: (event: WordProgressEvent) => void
  ): Promise<CourtFilingGenerateResponse> {
    console.log('[ApiClient] generateCourtFilingStream starting...');

    return new Promise((resolve, reject) => {
      // Create stream context and cleanup function using shared utility
      const ctx = createStreamContext();
      const cleanup = createStreamCleanup(ctx, reject);

      ctx.timeoutId = setTimeout(() => {
        console.error('[ApiClient] generateCourtFilingStream timeout after 5 minutes');
        cleanup(new Error('Request timeout - generation took too long'));
      }, STREAM_TIMEOUT_MS);

      fetch(`${API_BASE_URL}/api/ai/word/court-filing/generate/stream`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(request),
        mode: 'cors',
        credentials: 'omit',
      })
        .then(async (response) => {
          if (!response.ok) {
            cleanup();
            const errorData = await response.json().catch(() => ({}));
            reject(new Error(errorData.message || `Request failed: ${response.status}`));
            return;
          }

          ctx.reader = response.body?.getReader() || null;
          if (!ctx.reader) {
            cleanup(new Error('No response body'));
            return;
          }

          const decoder = new TextDecoder();
          let buffer = '';
          let eventType = '';

          const processBuffer = () => {
            // Check buffer size to prevent memory exhaustion
            if (ctx.accumulatedContent.length > MAX_BUFFER_SIZE) {
              cleanup(new Error(`Response too large (max ${MAX_BUFFER_SIZE / 1024 / 1024}MB)`));
              return false;
            }

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                const data = line.slice(5).trim();
                if (!data) continue;

                try {
                  if (eventType === 'chunk') {
                    const chunk = JSON.parse(data);
                    ctx.accumulatedContent += chunk;
                    onChunk(chunk);
                  } else if (eventType === 'progress') {
                    // Progress event (tool usage, thinking, phase updates)
                    if (onProgress) {
                      const progressEvent = JSON.parse(data);
                      onProgress(progressEvent);
                    }
                  } else if (eventType === 'done') {
                    const metadata = JSON.parse(data);
                    const result = {
                      content: ctx.accumulatedContent,
                      title: metadata.title,
                      template: metadata.template,
                      tokensUsed: metadata.tokensUsed,
                      processingTimeMs: metadata.processingTimeMs,
                      validation: metadata.validation,
                    };
                    cleanup();
                    resolve(result);
                  } else if (eventType === 'error') {
                    const errorData = JSON.parse(data);
                    // Defensive parsing - handle various error shapes
                    const errorMessage =
                      typeof errorData === 'string'
                        ? errorData
                        : errorData?.error || errorData?.message || 'Streaming error';
                    cleanup(new Error(errorMessage));
                  }
                } catch (e) {
                  console.warn('Failed to parse SSE data:', e);
                }
              }
            }
            return true;
          };

          try {
            while (true) {
              const { done, value } = await ctx.reader!.read();

              if (value) {
                buffer += decoder.decode(value, { stream: true });
                if (!processBuffer()) {
                  return;
                }
              }

              if (done) {
                buffer += decoder.decode(new Uint8Array(), { stream: false });
                if (buffer.trim()) {
                  buffer += '\n';
                  processBuffer();
                }
                break;
              }
            }
          } catch (readError) {
            cleanup(readError instanceof Error ? readError : new Error('Read error'));
          }
        })
        .catch((err) => {
          cleanup();
          console.error('[ApiClient] generateCourtFilingStream fetch error:', err);
          reject(err);
        });
    });
  }

  /**
   * Draft document from template with streaming response.
   * Prevents timeout on long-running generation by using SSE with keepalive.
   */
  async draftFromTemplateStream(
    request: DraftFromTemplateRequest,
    onChunk: (chunk: string) => void
  ): Promise<DraftFromTemplateResponse> {
    console.log('[ApiClient] draftFromTemplateStream starting...');

    return new Promise((resolve, reject) => {
      // Create stream context and cleanup function using shared utility
      const ctx = createStreamContext();
      const cleanup = createStreamCleanup(ctx, reject);

      ctx.timeoutId = setTimeout(() => {
        console.error('[ApiClient] draftFromTemplateStream timeout after 5 minutes');
        cleanup(new Error('Request timeout - generation took too long'));
      }, STREAM_TIMEOUT_MS);

      fetch(`${API_BASE_URL}/api/ai/word/draft-from-template/stream`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(request),
        mode: 'cors',
        credentials: 'omit',
      })
        .then(async (response) => {
          if (!response.ok) {
            cleanup();
            const errorData = await response.json().catch(() => ({}));
            reject(new Error(errorData.message || `Request failed: ${response.status}`));
            return;
          }

          ctx.reader = response.body?.getReader() || null;
          if (!ctx.reader) {
            cleanup(new Error('No response body'));
            return;
          }

          const decoder = new TextDecoder();
          let buffer = '';
          let eventType = '';

          const processBuffer = () => {
            // Check buffer size to prevent memory exhaustion
            if (ctx.accumulatedContent.length > MAX_BUFFER_SIZE) {
              cleanup(new Error(`Response too large (max ${MAX_BUFFER_SIZE / 1024 / 1024}MB)`));
              return false;
            }

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                const data = line.slice(5).trim();
                if (!data) continue;

                try {
                  if (eventType === 'chunk') {
                    const chunk = JSON.parse(data);
                    ctx.accumulatedContent += chunk;
                    onChunk(chunk);
                  } else if (eventType === 'done') {
                    const metadata = JSON.parse(data);
                    const result = {
                      content: ctx.accumulatedContent,
                      title: metadata.title,
                      templateUsed: metadata.templateUsed,
                      tokensUsed: metadata.tokensUsed,
                      processingTimeMs: metadata.processingTimeMs,
                    };
                    cleanup();
                    resolve(result);
                  } else if (eventType === 'error') {
                    const error = JSON.parse(data);
                    cleanup(new Error(error.error || 'Streaming error'));
                  }
                } catch (e) {
                  console.warn('Failed to parse SSE data:', e);
                }
              }
            }
            return true;
          };

          try {
            while (true) {
              const { done, value } = await ctx.reader!.read();

              if (value) {
                buffer += decoder.decode(value, { stream: true });
                if (!processBuffer()) {
                  return;
                }
              }

              if (done) {
                buffer += decoder.decode(new Uint8Array(), { stream: false });
                if (buffer.trim()) {
                  buffer += '\n';
                  processBuffer();
                }
                break;
              }
            }
          } catch (readError) {
            cleanup(readError instanceof Error ? readError : new Error('Read error'));
          }
        })
        .catch((err) => {
          cleanup();
          console.error('[ApiClient] draftFromTemplateStream fetch error:', err);
          reject(err);
        });
    });
  }

  /**
   * Get user's active cases (for case selector)
   */
  async getActiveCases(): Promise<{ cases: ActiveCase[] }> {
    return this.get<{ cases: ActiveCase[] }>(`${API_BASE_URL}/api/ai/word/cases`);
  }

  /**
   * Get user's active clients (for client selector)
   */
  async getActiveClients(): Promise<{ clients: ActiveClient[] }> {
    return this.get<{ clients: ActiveClient[] }>(`${API_BASE_URL}/api/ai/word/clients`);
  }

  /**
   * Lookup which case/client a document belongs to by URL or file name
   */
  async lookupCaseByDocument(params: { url?: string; path?: string }): Promise<{
    case: ActiveCase | null;
    client: { id: string; name: string } | null;
    document: { id: string; fileName: string; sharePointPath: string } | null;
  }> {
    const query = new URLSearchParams();
    if (params.url) query.set('url', params.url);
    if (params.path) query.set('path', params.path);
    return this.get<{
      case: ActiveCase | null;
      client: { id: string; name: string } | null;
      document: { id: string; fileName: string; sharePointPath: string } | null;
    }>(`${API_BASE_URL}/api/ai/word/lookup-case?${query.toString()}`);
  }

  /**
   * Sync document with platform
   */
  async syncDocument(documentId: string): Promise<{ success: boolean; message: string }> {
    return this.post(`${API_BASE_URL}/api/documents/${documentId}/sync`, {});
  }

  /**
   * Get document info
   */
  async getDocument(documentId: string): Promise<unknown> {
    return this.get(`${API_BASE_URL}/api/documents/${documentId}`);
  }

  /**
   * Update document metadata
   */
  async updateDocumentMetadata(
    documentId: string,
    metadata: Record<string, unknown>
  ): Promise<unknown> {
    return this.patch(`${API_BASE_URL}/api/documents/${documentId}`, metadata);
  }

  /**
   * Save document to platform (SharePoint) and link to case
   * - If documentId is provided: updates existing document directly
   * - If no documentId: creates new or versions existing by filename match
   */
  async saveToPlatform(request: {
    caseId?: string;
    fileName: string;
    fileContent: string; // Base64 encoded .docx content
    documentId?: string; // If provided, updates this document directly
    generationMetadata?: {
      tokensUsed: number;
      processingTimeMs: number;
    };
  }): Promise<{
    success: boolean;
    documentId: string;
    fileName: string;
    isNewVersion: boolean;
    sharePointUrl: string;
    caseNumber?: string; // Returned for setting document properties
  }> {
    return this.post(`${API_BASE_URL}/api/ai/word/save-to-case`, request);
  }

  // ============================================================================
  // Edit Mode Methods
  // ============================================================================

  /**
   * Edit text using AI with conversational context
   * Sends a prompt with document/selection context and conversation history
   */
  async editText(request: EditRequest): Promise<EditResponse> {
    return this.post<EditResponse>(`${API_BASE_URL}/api/ai/word/edit`, request);
  }

  /**
   * Analyze a contract document for risky clauses
   * Uses premium mode (Opus) for full document scan with detailed reasoning
   */
  async analyzeContract(request: ContractAnalysisRequest): Promise<ContractAnalysisResponse> {
    return this.post<ContractAnalysisResponse>(
      `${API_BASE_URL}/api/ai/word/contract/analyze`,
      request
    );
  }

  /**
   * Research a specific clause for legislation and jurisprudence
   * Triggered by [Cercetează] button on individual clauses
   */
  async researchClause(request: ClauseResearchRequest): Promise<ClauseResearchResponse> {
    return this.post<ClauseResearchResponse>(
      `${API_BASE_URL}/api/ai/word/contract/research-clause`,
      request
    );
  }

  /**
   * Answer a clarifying question from the contract analysis
   * Returns updated analysis with refined results based on the answer
   */
  async answerClarifyingQuestion(
    analysisId: string,
    questionId: string,
    answerId: string
  ): Promise<ContractAnalysisResponse> {
    return this.post<ContractAnalysisResponse>(`${API_BASE_URL}/api/ai/word/contract/answer`, {
      analysisId,
      questionId,
      answerId,
    });
  }

  // ============================================================================
  // User Methods
  // ============================================================================

  /**
   * Get current authenticated user info including role
   * Used to determine feature access (Expert Mode, etc.)
   */
  async getCurrentUser(): Promise<{
    id: string;
    email: string;
    name: string;
    firstName: string;
    lastName: string;
    role: 'Partner' | 'Associate' | 'AssociateJr' | 'Paralegal' | 'BusinessOwner' | 'Admin';
    firmId: string;
    status: string;
    hasOperationalOversight: boolean;
  }> {
    return this.get(`${API_BASE_URL}/api/ai/word/me`);
  }

  // HTTP Methods

  private async get<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<T>(response);
  }

  private async post<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    return this.handleResponse<T>(response);
  }

  private async patch<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    return this.handleResponse<T>(response);
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('[ApiClient] Auth token present, length:', token.length);
    } else {
      console.warn('[ApiClient] No auth token available - requests may fail');
    }

    // Dev mode bypass for testing - ONLY in local development builds
    // This header is stripped/ignored by production gateway
    if (import.meta.env.DEV) {
      headers['X-Dev-Bypass'] = 'word-addin';
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get debug info for troubleshooting (visible in UI when errors occur)
   */
  getDebugInfo(): { apiUrl: string; hasToken: boolean; mode: string } {
    const token = getAccessToken();
    return {
      apiUrl: API_BASE_URL,
      hasToken: !!token,
      mode: import.meta.env.MODE || 'unknown',
    };
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
