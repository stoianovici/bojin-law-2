/**
 * API Client for Outlook Add-in
 *
 * Handles GraphQL calls to the backend for email-related operations.
 */

import { getAccessToken } from './auth';

// ============================================================================
// Constants
// ============================================================================

const API_BASE_URL = (() => {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin.includes('bojin-law.com') || origin.includes('localhost')) {
      return origin;
    }
  }
  return import.meta.env.VITE_API_BASE_URL || 'https://localhost:4000';
})();

console.log('[ApiClient] Initialized with API_BASE_URL:', API_BASE_URL);

// ============================================================================
// Types
// ============================================================================

export interface CaseSuggestion {
  id: string;
  title: string;
  caseNumber: string;
  confidence: number;
  matchReason: string;
  clientName?: string;
}

export interface EmailSyncStatus {
  isSynced: boolean;
  emailId?: string;
  caseId?: string;
  caseName?: string;
  syncedAt?: string;
  classificationState?: string;
}

export interface EmailLinkResult {
  success: boolean;
  emailId: string;
  caseId: string;
  caseName: string;
  isNewSync: boolean;
}

export interface ShareResult {
  success: boolean;
  shareId: string;
  sharedWith: string;
  sharedWithName: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface ActiveCase {
  id: string;
  title: string;
  caseNumber: string;
  clientName?: string;
}

// ============================================================================
// GraphQL Queries and Mutations
// ============================================================================

const SUGGEST_CASES_QUERY = `
  query SuggestCasesForEmail($internetMessageId: String!, $senderEmail: String!, $subject: String) {
    suggestCasesForEmail(internetMessageId: $internetMessageId, senderEmail: $senderEmail, subject: $subject) {
      id
      title
      caseNumber
      confidence
      matchReason
      clientName
    }
  }
`;

const EMAIL_SYNC_STATUS_QUERY = `
  query EmailSyncStatus($internetMessageId: String!) {
    emailSyncStatus(internetMessageId: $internetMessageId) {
      isSynced
      emailId
      caseId
      caseName
      syncedAt
      classificationState
    }
  }
`;

const LINK_EMAIL_MUTATION = `
  mutation LinkEmailFromOutlook($input: LinkEmailFromOutlookInput!) {
    linkEmailFromOutlook(input: $input) {
      success
      emailId
      caseId
      caseName
      isNewSync
    }
  }
`;

const SHARE_THREAD_MUTATION = `
  mutation ShareEmailThread($input: ShareThreadInput!) {
    shareEmailThread(input: $input) {
      success
      shareId
      sharedWith
      sharedWithName
    }
  }
`;

const TEAM_MEMBERS_QUERY = `
  query OutlookTeamMembers {
    outlookTeamMembers {
      id
      name
      email
      role
    }
  }
`;

const ACTIVE_CASES_QUERY = `
  query OutlookActiveCases {
    outlookActiveCases {
      id
      title
      caseNumber
      clientName
    }
  }
`;

// ============================================================================
// API Client Class
// ============================================================================

class ApiClient {
  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${API_BASE_URL}/graphql`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();

    if (result.errors && result.errors.length > 0) {
      throw new Error(result.errors[0].message);
    }

    return result.data;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.warn('[ApiClient] No auth token available');
    }

    if (import.meta.env.DEV) {
      headers['X-Dev-Bypass'] = 'outlook-addin';
    }

    return headers;
  }

  /**
   * Get case suggestions for an email based on sender, subject, etc.
   */
  async suggestCasesForEmail(
    internetMessageId: string,
    senderEmail: string,
    subject?: string
  ): Promise<CaseSuggestion[]> {
    const data = await this.graphql<{ suggestCasesForEmail: CaseSuggestion[] }>(
      SUGGEST_CASES_QUERY,
      { internetMessageId, senderEmail, subject }
    );
    return data.suggestCasesForEmail;
  }

  /**
   * Check if an email is already synced to the platform
   */
  async getEmailSyncStatus(internetMessageId: string): Promise<EmailSyncStatus> {
    const data = await this.graphql<{ emailSyncStatus: EmailSyncStatus }>(EMAIL_SYNC_STATUS_QUERY, {
      internetMessageId,
    });
    return data.emailSyncStatus;
  }

  /**
   * Link an email to a case from Outlook
   * This will sync the email if not already synced
   */
  async linkEmailFromOutlook(input: {
    internetMessageId: string;
    conversationId?: string;
    graphMessageId?: string;
    caseId: string;
    subject: string;
    senderEmail: string;
    senderName?: string;
    bodyPreview?: string;
    receivedDateTime?: string;
  }): Promise<EmailLinkResult> {
    const data = await this.graphql<{ linkEmailFromOutlook: EmailLinkResult }>(
      LINK_EMAIL_MUTATION,
      { input }
    );
    return data.linkEmailFromOutlook;
  }

  /**
   * Share an email thread with a colleague
   */
  async shareEmailThread(input: {
    conversationId: string;
    sharedWithUserId: string;
    accessLevel?: 'Read' | 'ReadWrite';
  }): Promise<ShareResult> {
    const data = await this.graphql<{ shareEmailThread: ShareResult }>(SHARE_THREAD_MUTATION, {
      input,
    });
    return data.shareEmailThread;
  }

  /**
   * Get team members for sharing
   */
  async getTeamMembers(): Promise<TeamMember[]> {
    const data = await this.graphql<{ outlookTeamMembers: TeamMember[] }>(TEAM_MEMBERS_QUERY);
    return data.outlookTeamMembers;
  }

  /**
   * Get active cases for linking
   */
  async getActiveCases(): Promise<ActiveCase[]> {
    const data = await this.graphql<{ outlookActiveCases: ActiveCase[] }>(ACTIVE_CASES_QUERY);
    return data.outlookActiveCases;
  }

  /**
   * Get debug info
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

// ============================================================================
// Singleton Instance
// ============================================================================

export const apiClient = new ApiClient();
