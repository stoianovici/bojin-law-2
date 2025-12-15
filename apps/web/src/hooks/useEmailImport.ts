/**
 * Email Import React Hooks
 * OPS-022: Email-to-Case Timeline Integration
 *
 * Provides hooks for previewing and executing email imports into cases
 */

import { gql } from '@apollo/client';
import { useMutation, useLazyQuery } from '@apollo/client/react';
import { useCallback, useState } from 'react';

// ============================================================================
// GraphQL Fragments
// ============================================================================

const CONTACT_CANDIDATE_FRAGMENT = gql`
  fragment ContactCandidateFields on ContactCandidate {
    email
    name
    occurrences
    suggestedRole
    isExistingActor
  }
`;

const DATE_RANGE_FRAGMENT = gql`
  fragment DateRangeFields on DateRange {
    start
    end
  }
`;

const EMAIL_IMPORT_PREVIEW_FRAGMENT = gql`
  ${CONTACT_CANDIDATE_FRAGMENT}
  ${DATE_RANGE_FRAGMENT}
  fragment EmailImportPreviewFields on EmailImportPreview {
    emailCount
    dateRange {
      ...DateRangeFields
    }
    contacts {
      ...ContactCandidateFields
    }
    attachmentCount
    threadCount
  }
`;

const EMAIL_IMPORT_RESULT_FRAGMENT = gql`
  fragment EmailImportResultFields on EmailImportResult {
    success
    emailsLinked
    contactsCreated
    attachmentsImported
    errors
    _debug {
      hadAccessToken
      importAttachmentsRequested
      emailsWithAttachmentsCount
      attachmentSyncDetails {
        emailId
        graphMessageId
        attachmentsFromGraph
        attachmentsSynced
        attachmentsSkipped
        attachmentsAlreadyExist
        errors
      }
    }
  }
`;

// ============================================================================
// Queries
// ============================================================================

const PREVIEW_EMAIL_IMPORT = gql`
  ${EMAIL_IMPORT_PREVIEW_FRAGMENT}
  query PreviewEmailImport($emailAddresses: [String!]!) {
    previewEmailImport(emailAddresses: $emailAddresses) {
      ...EmailImportPreviewFields
    }
  }
`;

// ============================================================================
// Mutations
// ============================================================================

const EXECUTE_EMAIL_IMPORT = gql`
  ${EMAIL_IMPORT_RESULT_FRAGMENT}
  mutation ExecuteEmailImport($input: ExecuteEmailImportInput!) {
    executeEmailImport(input: $input) {
      ...EmailImportResultFields
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface ContactCandidate {
  email: string;
  name: string | null;
  occurrences: number;
  suggestedRole: 'Client' | 'OpposingParty' | 'OpposingCounsel' | 'Witness' | 'Expert' | null;
  isExistingActor: boolean;
}

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export interface EmailImportPreview {
  emailCount: number;
  dateRange: DateRange;
  contacts: ContactCandidate[];
  attachmentCount: number;
  threadCount: number;
}

export interface ContactRoleAssignment {
  email: string;
  name: string | null;
  role: 'Client' | 'OpposingParty' | 'OpposingCounsel' | 'Witness' | 'Expert';
}

export interface AttachmentSyncDetail {
  emailId: string;
  graphMessageId: string;
  attachmentsFromGraph: number;
  attachmentsSynced: number;
  attachmentsSkipped: number;
  attachmentsAlreadyExist: number;
  errors: string[];
}

export interface EmailImportDebugInfo {
  hadAccessToken: boolean;
  importAttachmentsRequested: boolean;
  emailsWithAttachmentsCount: number;
  attachmentSyncDetails?: AttachmentSyncDetail[];
}

export interface EmailImportResult {
  success: boolean;
  emailsLinked: number;
  contactsCreated: number;
  attachmentsImported: number;
  errors: string[];
  _debug?: EmailImportDebugInfo;
}

export interface EmailImportState {
  step: 'input' | 'preview' | 'assign' | 'importing' | 'complete';
  emailAddresses: string[];
  preview: EmailImportPreview | null;
  contactAssignments: ContactRoleAssignment[];
  importAttachments: boolean;
  result: EmailImportResult | null;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for email import wizard flow
 * Manages the multi-step import process
 */
export function useEmailImport(caseId: string) {
  // State management
  const [state, setState] = useState<EmailImportState>({
    step: 'input',
    emailAddresses: [],
    preview: null,
    contactAssignments: [],
    importAttachments: true,
    result: null,
  });

  // GraphQL operations
  const [fetchPreview, { loading: previewLoading, error: previewError }] = useLazyQuery<{
    previewEmailImport: EmailImportPreview;
  }>(PREVIEW_EMAIL_IMPORT, {
    fetchPolicy: 'network-only',
  });

  const [executeImportMutation, { loading: importLoading, error: importError }] = useMutation<{
    executeEmailImport: EmailImportResult;
  }>(EXECUTE_EMAIL_IMPORT);

  // Update email addresses
  const setEmailAddresses = useCallback((addresses: string[]) => {
    setState((prev) => ({
      ...prev,
      emailAddresses: addresses,
      preview: null, // Reset preview when addresses change
    }));
  }, []);

  // Fetch preview based on email addresses
  const loadPreview = useCallback(async () => {
    if (state.emailAddresses.length === 0) {
      return null;
    }

    try {
      const result = await fetchPreview({
        variables: { emailAddresses: state.emailAddresses },
      });

      const preview = result.data?.previewEmailImport;
      if (preview) {
        // Initialize contact assignments from preview
        const contactAssignments: ContactRoleAssignment[] = preview.contacts
          .filter((c: ContactCandidate) => !c.isExistingActor && c.suggestedRole)
          .map((c: ContactCandidate) => ({
            email: c.email,
            name: c.name,
            role: c.suggestedRole as ContactRoleAssignment['role'],
          }));

        setState((prev) => ({
          ...prev,
          step: 'preview',
          preview,
          contactAssignments,
        }));

        return preview;
      }

      return null;
    } catch (err) {
      console.error('[useEmailImport] Preview error:', err);
      return null;
    }
  }, [state.emailAddresses, fetchPreview]);

  // Update contact assignment
  const updateContactAssignment = useCallback(
    (email: string, role: ContactRoleAssignment['role'] | null) => {
      setState((prev) => {
        const existing = prev.contactAssignments.find((ca) => ca.email === email);
        const contact = prev.preview?.contacts.find((c) => c.email === email);

        if (role === null) {
          // Remove assignment
          return {
            ...prev,
            contactAssignments: prev.contactAssignments.filter((ca) => ca.email !== email),
          };
        }

        if (existing) {
          // Update existing
          return {
            ...prev,
            contactAssignments: prev.contactAssignments.map((ca) =>
              ca.email === email ? { ...ca, role } : ca
            ),
          };
        }

        // Add new
        return {
          ...prev,
          contactAssignments: [
            ...prev.contactAssignments,
            {
              email,
              name: contact?.name || null,
              role,
            },
          ],
        };
      });
    },
    []
  );

  // Toggle attachment import
  const setImportAttachments = useCallback((value: boolean) => {
    setState((prev) => ({
      ...prev,
      importAttachments: value,
    }));
  }, []);

  // Go to assign roles step
  const goToAssignStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: 'assign',
    }));
  }, []);

  // Execute the import
  const executeImport = useCallback(async () => {
    setState((prev) => ({ ...prev, step: 'importing' }));

    try {
      const result = await executeImportMutation({
        variables: {
          input: {
            caseId,
            emailAddresses: state.emailAddresses,
            contactAssignments: state.contactAssignments,
            importAttachments: state.importAttachments,
          },
        },
      });

      const importResult = result.data?.executeEmailImport ?? null;

      // Log debug info to help diagnose attachment import issues
      console.log('[useEmailImport] Import result:', {
        success: importResult?.success,
        emailsLinked: importResult?.emailsLinked,
        attachmentsImported: importResult?.attachmentsImported,
        errors: importResult?.errors,
        _debug: importResult?._debug,
      });

      setState((prev) => ({
        ...prev,
        step: 'complete',
        result: importResult,
      }));

      return importResult;
    } catch (err) {
      console.error('[useEmailImport] Import error:', err);
      setState((prev) => ({
        ...prev,
        step: 'complete',
        result: {
          success: false,
          emailsLinked: 0,
          contactsCreated: 0,
          attachmentsImported: 0,
          errors: [(err as Error).message],
        },
      }));
      return null;
    }
  }, [
    caseId,
    state.emailAddresses,
    state.contactAssignments,
    state.importAttachments,
    executeImportMutation,
  ]);

  // Reset wizard
  const reset = useCallback(() => {
    setState({
      step: 'input',
      emailAddresses: [],
      preview: null,
      contactAssignments: [],
      importAttachments: true,
      result: null,
    });
  }, []);

  // Go back one step
  const goBack = useCallback(() => {
    setState((prev) => {
      switch (prev.step) {
        case 'preview':
          return { ...prev, step: 'input' };
        case 'assign':
          return { ...prev, step: 'preview' };
        default:
          return prev;
      }
    });
  }, []);

  return {
    // State
    step: state.step,
    emailAddresses: state.emailAddresses,
    preview: state.preview,
    contactAssignments: state.contactAssignments,
    importAttachments: state.importAttachments,
    result: state.result,

    // Loading states
    previewLoading,
    importLoading,

    // Errors
    previewError,
    importError,

    // Actions
    setEmailAddresses,
    loadPreview,
    updateContactAssignment,
    setImportAttachments,
    goToAssignStep,
    executeImport,
    reset,
    goBack,

    // Computed
    canLoadPreview: state.emailAddresses.length > 0,
    hasEmails: (state.preview?.emailCount || 0) > 0,
  };
}

/**
 * Simpler hook for just previewing email imports
 */
export function useEmailImportPreview() {
  const [fetchPreview, { data, loading, error }] = useLazyQuery<{
    previewEmailImport: EmailImportPreview;
  }>(PREVIEW_EMAIL_IMPORT, {
    fetchPolicy: 'network-only',
  });

  const preview = useCallback(
    async (emailAddresses: string[]) => {
      const result = await fetchPreview({
        variables: { emailAddresses },
      });
      return result.data?.previewEmailImport || null;
    },
    [fetchPreview]
  );

  return {
    preview,
    data: data?.previewEmailImport,
    loading,
    error,
  };
}
