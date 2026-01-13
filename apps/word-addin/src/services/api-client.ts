/**
 * API Client for Word Add-in
 * Story 3.4: Word Integration with Live AI Assistance - Task 14
 *
 * Handles API calls to the backend AI service.
 */

import { getAccessToken } from './auth';

// Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://localhost:4000';

// Types
interface SuggestionRequest {
  documentId?: string;
  selectedText: string;
  cursorContext: string;
  suggestionType: 'completion' | 'alternative' | 'precedent';
  caseId?: string;
  customInstructions?: string;
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
}

interface DraftRequest {
  caseId: string;
  documentName: string;
  prompt: string;
  existingContent?: string;
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

interface ImproveResponse {
  original: string;
  improved: string;
  /** OOXML fragment for style-aware insertion via Word's insertOoxml() API */
  ooxmlContent?: string;
  explanation: string;
  processingTimeMs: number;
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
    return new Promise((resolve, reject) => {
      // Use fetch with SSE for streaming
      fetch(`${API_BASE_URL}/api/ai/word/draft/stream`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            reject(new Error(errorData.message || `Request failed: ${response.status}`));
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            reject(new Error('No response body'));
            return;
          }

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE events in buffer
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            let eventType = '';
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
                    onChunk(chunk);
                  } else if (eventType === 'progress') {
                    // Progress event (tool usage, thinking)
                    if (onProgress) {
                      const progressEvent = JSON.parse(data);
                      onProgress(progressEvent);
                    }
                  } else if (eventType === 'done') {
                    // Final response with OOXML
                    const result = JSON.parse(data);
                    resolve(result);
                  } else if (eventType === 'error') {
                    const error = JSON.parse(data);
                    reject(new Error(error.error || 'Streaming error'));
                  }
                } catch (e) {
                  console.warn('Failed to parse SSE data:', e);
                }
              }
            }
          }
        })
        .catch(reject);
    });
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
   * Get user's active cases (for case selector)
   */
  async getActiveCases(): Promise<{ cases: ActiveCase[] }> {
    return this.get<{ cases: ActiveCase[] }>(`${API_BASE_URL}/api/ai/word/cases`);
  }

  /**
   * Lookup which case a document belongs to by URL or file name
   */
  async lookupCaseByDocument(params: {
    url?: string;
    path?: string;
  }): Promise<{ case: ActiveCase | null }> {
    const query = new URLSearchParams();
    if (params.url) query.set('url', params.url);
    if (params.path) query.set('path', params.path);
    return this.get<{ case: ActiveCase | null }>(
      `${API_BASE_URL}/api/ai/word/lookup-case?${query.toString()}`
    );
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
    }

    // Dev mode bypass for testing
    if (import.meta.env.DEV || import.meta.env.VITE_DEV_BYPASS === 'true') {
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
}

// Export singleton instance
export const apiClient = new ApiClient();
