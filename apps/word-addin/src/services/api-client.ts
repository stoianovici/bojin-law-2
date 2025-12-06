/**
 * API Client for Word Add-in
 * Story 3.4: Word Integration with Live AI Assistance - Task 14
 *
 * Handles API calls to the backend AI service.
 */

import { getAccessToken } from './auth';

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'https://localhost:4000';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'https://localhost:5000';

// Types
interface SuggestionRequest {
  documentId: string;
  selectedText: string;
  cursorContext: string;
  suggestionType: 'completion' | 'alternative' | 'precedent';
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
  documentId: string;
  selectedText: string;
}

interface ExplainResponse {
  explanation: string;
  legalBasis?: string;
  sourceReferences?: string[];
  processingTimeMs: number;
}

interface ImproveRequest {
  documentId: string;
  selectedText: string;
  improvementType: 'clarity' | 'formality' | 'brevity' | 'legal_precision';
}

interface ImproveResponse {
  original: string;
  improved: string;
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
    return this.post<SuggestionResponse>(`${AI_SERVICE_URL}/api/ai/word/suggest`, request);
  }

  /**
   * Explain legal text
   */
  async explainText(request: ExplainRequest): Promise<ExplainResponse> {
    return this.post<ExplainResponse>(`${AI_SERVICE_URL}/api/ai/word/explain`, request);
  }

  /**
   * Improve text
   */
  async improveText(request: ImproveRequest): Promise<ImproveResponse> {
    return this.post<ImproveResponse>(`${AI_SERVICE_URL}/api/ai/word/improve`, request);
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
  async getDocument(documentId: string): Promise<any> {
    return this.get(`${API_BASE_URL}/api/documents/${documentId}`);
  }

  /**
   * Update document metadata
   */
  async updateDocumentMetadata(documentId: string, metadata: Record<string, any>): Promise<any> {
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

  private async post<T>(url: string, body: any): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    return this.handleResponse<T>(response);
  }

  private async patch<T>(url: string, body: any): Promise<T> {
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
