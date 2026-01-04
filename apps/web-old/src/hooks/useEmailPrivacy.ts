/**
 * useEmailPrivacy Hook
 * OPS-194: Email privacy management for partners
 *
 * Provides privacy toggle functionality for email threads.
 * Only partners can mark emails as private.
 */

import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useAuth } from '../contexts/AuthContext';
import { useNotificationStore } from '../stores/notificationStore';

// ============================================================================
// GraphQL Mutations
// ============================================================================

const MARK_EMAIL_PRIVATE = gql`
  mutation MarkEmailPrivate($emailId: ID!) {
    markEmailPrivate(emailId: $emailId) {
      id
      isPrivate
      markedPrivateBy
      markedPrivateAt
    }
  }
`;

const UNMARK_EMAIL_PRIVATE = gql`
  mutation UnmarkEmailPrivate($emailId: ID!) {
    unmarkEmailPrivate(emailId: $emailId) {
      id
      isPrivate
      markedPrivateBy
      markedPrivateAt
    }
  }
`;

const MARK_THREAD_PRIVATE = gql`
  mutation MarkThreadPrivate($conversationId: String!) {
    markThreadPrivate(conversationId: $conversationId) {
      id
      isPrivate
      markedPrivateBy
      markedPrivateAt
    }
  }
`;

const UNMARK_THREAD_PRIVATE = gql`
  mutation UnmarkThreadPrivate($conversationId: String!) {
    unmarkThreadPrivate(conversationId: $conversationId) {
      id
      isPrivate
      markedPrivateBy
      markedPrivateAt
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

interface PrivacyState {
  /** Whether the email/thread is private */
  isPrivate: boolean;
  /** Whether the current user can toggle privacy (must be Partner) */
  canToggle: boolean;
  /** Loading state for privacy mutations */
  loading: boolean;
}

interface UseEmailPrivacyOptions {
  /** Email ID for single email privacy */
  emailId?: string;
  /** Conversation ID for thread-level privacy */
  conversationId?: string;
  /** Current privacy state (from email/thread data) */
  isCurrentlyPrivate?: boolean;
  /** Callback when privacy is toggled successfully */
  onToggled?: (isPrivate: boolean) => void;
}

interface UseEmailPrivacyResult extends PrivacyState {
  /** Toggle privacy for a single email */
  toggleEmailPrivacy: (emailId: string, currentlyPrivate: boolean) => Promise<void>;
  /** Toggle privacy for entire thread */
  toggleThreadPrivacy: (conversationId: string, currentlyPrivate: boolean) => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

export function useEmailPrivacy(options: UseEmailPrivacyOptions = {}): UseEmailPrivacyResult {
  const { isCurrentlyPrivate = false, onToggled } = options;
  const { user } = useAuth();
  const { addNotification } = useNotificationStore();

  // Mutations
  const [markEmailPrivate, { loading: markingEmail }] = useMutation(MARK_EMAIL_PRIVATE);
  const [unmarkEmailPrivate, { loading: unmarkingEmail }] = useMutation(UNMARK_EMAIL_PRIVATE);
  const [markThreadPrivate, { loading: markingThread }] = useMutation(MARK_THREAD_PRIVATE);
  const [unmarkThreadPrivate, { loading: unmarkingThread }] = useMutation(UNMARK_THREAD_PRIVATE);

  // Only partners can toggle privacy
  const isPartner = user?.role === 'Partner';
  const loading = markingEmail || unmarkingEmail || markingThread || unmarkingThread;

  /**
   * Toggle privacy for a single email
   */
  const toggleEmailPrivacy = async (emailId: string, currentlyPrivate: boolean) => {
    if (!isPartner) {
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: 'Doar partenerii pot marca emailurile ca private',
      });
      return;
    }

    try {
      if (currentlyPrivate) {
        await unmarkEmailPrivate({
          variables: { emailId },
        });
        addNotification({
          type: 'success',
          title: 'Succes',
          message: 'Emailul nu mai este privat',
        });
        onToggled?.(false);
      } else {
        await markEmailPrivate({
          variables: { emailId },
        });
        addNotification({
          type: 'success',
          title: 'Succes',
          message: 'Emailul a fost marcat ca privat',
        });
        onToggled?.(true);
      }
    } catch (error) {
      console.error('Failed to toggle email privacy:', error);
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: currentlyPrivate
          ? 'Nu s-a putut anula marcarea emailului ca privat'
          : 'Nu s-a putut marca emailul ca privat',
      });
    }
  };

  /**
   * Toggle privacy for entire thread
   */
  const toggleThreadPrivacy = async (conversationId: string, currentlyPrivate: boolean) => {
    if (!isPartner) {
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: 'Doar partenerii pot marca conversațiile ca private',
      });
      return;
    }

    try {
      if (currentlyPrivate) {
        await unmarkThreadPrivate({
          variables: { conversationId },
        });
        addNotification({
          type: 'success',
          title: 'Succes',
          message: 'Conversația nu mai este privată',
        });
        onToggled?.(false);
      } else {
        await markThreadPrivate({
          variables: { conversationId },
        });
        addNotification({
          type: 'success',
          title: 'Succes',
          message: 'Conversația a fost marcată ca privată',
        });
        onToggled?.(true);
      }
    } catch (error) {
      console.error('Failed to toggle thread privacy:', error);
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: currentlyPrivate
          ? 'Nu s-a putut anula marcarea conversației ca privată'
          : 'Nu s-a putut marca conversația ca privată',
      });
    }
  };

  return {
    isPrivate: isCurrentlyPrivate,
    canToggle: isPartner,
    loading,
    toggleEmailPrivacy,
    toggleThreadPrivacy,
  };
}
