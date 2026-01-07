'use client';

import { useMemo } from 'react';
import { useQuery } from './useGraphQL';
import { GET_CASE, GET_EMAIL_THREADS_BY_PARTICIPANTS } from '@/graphql/queries';
import type { EmailThread, ThreadPreview } from '@/types/email';
import type { CaseEmailFilterMode } from '@/components/email/CaseEmailFilter';

// ============================================================================
// Types
// ============================================================================

interface CaseData {
  case: {
    id: string;
    title: string;
    caseNumber: string;
    client: {
      id: string;
      name: string;
      contactInfo: {
        email?: string;
      } | null;
    } | null;
    actors: Array<{
      id: string;
      name: string;
      email: string | null;
    }>;
  };
}

interface EmailThreadsData {
  emailThreads: EmailThread[];
}

interface UseEmailsByContactResult {
  threads: ThreadPreview[];
  fullThreads: EmailThread[];
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<void>;
  clientEmail: string | null;
  participantEmails: string[];
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for fetching email threads by case contacts
 *
 * Implements the "Client-first with case filter" pattern:
 * - Fetches case to get client email + actor emails
 * - Queries emailThreads with participantEmails filter
 * - For "case" mode, also filters by caseId
 * - For "client" mode, only filters by participant emails
 *
 * @param caseId - The case ID to fetch emails for
 * @param filterMode - "case" (this case only) or "client" (all client cases)
 */
export function useEmailsByContact(
  caseId: string,
  filterMode: CaseEmailFilterMode = 'case'
): UseEmailsByContactResult {
  // Fetch case data to get contact emails
  const {
    data: caseData,
    loading: caseLoading,
    error: caseError,
  } = useQuery<CaseData>(GET_CASE, {
    variables: { id: caseId },
    skip: !caseId,
  });

  // Extract contact emails from case
  const { participantEmails, clientEmail } = useMemo(() => {
    if (!caseData?.case) {
      return { participantEmails: [], clientEmail: null };
    }

    const emails: string[] = [];
    let clientEmailVal: string | null = null;

    // Add client email if available
    const cEmail = caseData.case.client?.contactInfo?.email;
    if (cEmail) {
      emails.push(cEmail.toLowerCase());
      clientEmailVal = cEmail.toLowerCase();
    }

    // Add actor emails
    for (const actor of caseData.case.actors || []) {
      if (actor.email) {
        const actorEmail = actor.email.toLowerCase();
        if (!emails.includes(actorEmail)) {
          emails.push(actorEmail);
        }
      }
    }

    return { participantEmails: emails, clientEmail: clientEmailVal };
  }, [caseData]);

  // Fetch email threads filtered by contact emails
  const {
    data: emailData,
    loading: emailLoading,
    error: emailError,
    refetch,
  } = useQuery<EmailThreadsData>(GET_EMAIL_THREADS_BY_PARTICIPANTS, {
    variables: {
      participantEmails,
      // For "case" mode, also filter by caseId
      // For "client" mode, only filter by participant emails
      caseId: filterMode === 'case' ? caseId : null,
      limit: 50,
      offset: 0,
    },
    skip: participantEmails.length === 0,
  });

  // Transform EmailThread to ThreadPreview for UI
  const threads: ThreadPreview[] = useMemo(() => {
    if (!emailData?.emailThreads) return [];

    return emailData.emailThreads.map((thread): ThreadPreview => {
      // Get last email in thread for preview
      const emails = [...thread.emails].sort(
        (a, b) => new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime()
      );
      const lastEmail = emails[0];

      // Create preview from body content (first 150 chars, stripped of HTML)
      const bodyPreview = lastEmail?.bodyContent
        ? lastEmail.bodyContent.replace(/<[^>]*>/g, '').slice(0, 150)
        : '';

      return {
        id: thread.id,
        conversationId: thread.conversationId,
        subject: thread.subject || '(Fara subiect)',
        lastMessageDate: thread.lastMessageDate,
        lastSenderName: lastEmail?.from?.name || '',
        lastSenderEmail: lastEmail?.from?.address || '',
        preview: bodyPreview,
        isUnread: thread.hasUnread,
        hasAttachments: thread.hasAttachments,
        messageCount: thread.messageCount,
        linkedCases: thread.case
          ? [
              {
                id: thread.case.id,
                title: thread.case.title,
                caseNumber: thread.case.caseNumber,
                isPrimary: true,
              },
            ]
          : [],
      };
    });
  }, [emailData]);

  // Preserve full thread data with emails for conversation view
  const fullThreads: EmailThread[] = useMemo(() => {
    return emailData?.emailThreads || [];
  }, [emailData]);

  return {
    threads,
    fullThreads,
    loading: caseLoading || emailLoading,
    error: caseError || emailError,
    refetch,
    clientEmail,
    participantEmails,
  };
}
