/**
 * Email Import React Hooks
 * OPS-022: Email-to-Case Timeline Integration
 * OPS-030: Email Import with Classification
 *
 * Provides hooks for previewing and executing email imports into cases,
 * with optional multi-case classification for clients with multiple cases.
 */

import { gql } from '@apollo/client';
import { useMutation, useLazyQuery, useQuery } from '@apollo/client/react';
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
  fragment DateRangeFields on EmailImportDateRange {
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
        upgradedWithDocument
        orphanedDocumentIds
        missingCaseDocument
        linkedToCase
        emailCaseId
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

// OPS-030: Classification queries
const CLIENT_HAS_MULTIPLE_CASES = gql`
  query ClientHasMultipleCases($caseId: ID!) {
    clientHasMultipleCases(caseId: $caseId)
  }
`;

const PREVIEW_CLASSIFICATION_FOR_IMPORT = gql`
  query PreviewClassificationForImport($input: PreviewClassificationForImportInput!) {
    previewClassificationForImport(input: $input) {
      totalEmails
      needsReview
      unclassified
      classifications {
        emailId
        email {
          id
          subject
          from
          fromName
          receivedDateTime
          hasAttachments
        }
        suggestedCaseId
        suggestedCase {
          id
          title
        }
        confidence
        reasons
        alternativeCases {
          caseId
          case {
            id
            title
          }
          confidence
          reason
        }
        needsHumanReview
        reviewReason
        matchType
        isGlobalSource
        globalSourceName
      }
      byCase {
        caseId
        case {
          id
          title
        }
        emailCount
        autoClassified
        needsReview
      }
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

// OPS-030: Classified import mutation
const EXECUTE_CLASSIFIED_IMPORT = gql`
  mutation ExecuteClassifiedImport($input: ExecuteClassifiedImportInput!) {
    executeClassifiedImport(input: $input) {
      success
      totalEmailsImported
      totalAttachmentsImported
      importedByCase {
        caseId
        case {
          id
          title
        }
        emailsImported
        attachmentsImported
        contactsCreated
      }
      excluded
      errors
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
  upgradedWithDocument: number;
  orphanedDocumentIds: number;
  missingCaseDocument: number;
  linkedToCase: number;
  emailCaseId: string | null;
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
  step: 'input' | 'preview' | 'classify' | 'assign' | 'importing' | 'complete';
  emailAddresses: string[];
  preview: EmailImportPreview | null;
  contactAssignments: ContactRoleAssignment[];
  importAttachments: boolean;
  result: EmailImportResult | null;
  // OPS-030: Classification state
  classificationPreview: ClassificationPreview | null;
  classificationOverrides: ClassificationOverride[];
  excludedEmailIds: string[];
}

// ============================================================================
// OPS-030: Classification Types
// ============================================================================

export type MatchType = 'ACTOR' | 'REFERENCE' | 'KEYWORD' | 'SEMANTIC' | 'NONE';

export interface EmailForClassification {
  id: string;
  subject: string | null;
  from: string | null;
  fromName: string | null;
  receivedDateTime: Date | null;
  hasAttachments: boolean;
}

export interface CaseRef {
  id: string;
  title: string;
}

export interface AlternativeCase {
  caseId: string;
  case: CaseRef | null;
  confidence: number;
  reason: string;
}

export interface ClassificationResult {
  emailId: string;
  email: EmailForClassification | null;
  suggestedCaseId: string | null;
  suggestedCase: CaseRef | null;
  confidence: number;
  reasons: string[];
  alternativeCases: AlternativeCase[];
  needsHumanReview: boolean;
  reviewReason: string | null;
  matchType: MatchType;
  isGlobalSource: boolean;
  globalSourceName: string | null;
}

export interface CaseClassificationSummary {
  caseId: string;
  case: CaseRef;
  emailCount: number;
  autoClassified: number;
  needsReview: number;
}

export interface ClassificationPreview {
  totalEmails: number;
  classifications: ClassificationResult[];
  byCase: CaseClassificationSummary[];
  needsReview: number;
  unclassified: number;
}

export interface ClassificationOverride {
  emailId: string;
  caseId: string;
}

export interface CaseImportSummary {
  caseId: string;
  case: CaseRef;
  emailsImported: number;
  attachmentsImported: number;
  contactsCreated: number;
}

export interface ClassifiedImportResult {
  success: boolean;
  totalEmailsImported: number;
  totalAttachmentsImported: number;
  importedByCase: CaseImportSummary[];
  excluded: number;
  errors: string[];
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for email import wizard flow
 * Manages the multi-step import process with optional classification
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
    classificationPreview: null,
    classificationOverrides: [],
    excludedEmailIds: [],
  });

  // OPS-030: Check if client has multiple cases
  const { data: multipleCasesData, loading: checkingMultipleCases } = useQuery<{
    clientHasMultipleCases: boolean;
  }>(CLIENT_HAS_MULTIPLE_CASES, {
    variables: { caseId },
    skip: !caseId,
  });

  const hasMultipleCases = multipleCasesData?.clientHasMultipleCases ?? false;

  // GraphQL operations
  const [fetchPreview, { loading: previewLoading, error: previewError }] = useLazyQuery<{
    previewEmailImport: EmailImportPreview;
  }>(PREVIEW_EMAIL_IMPORT, {
    fetchPolicy: 'network-only',
  });

  // OPS-030: Classification preview query
  const [
    fetchClassificationPreview,
    { loading: classificationLoading, error: classificationError },
  ] = useLazyQuery<{
    previewClassificationForImport: ClassificationPreview;
  }>(PREVIEW_CLASSIFICATION_FOR_IMPORT, {
    fetchPolicy: 'network-only',
  });

  const [executeImportMutation, { loading: importLoading, error: importError }] = useMutation<{
    executeEmailImport: EmailImportResult;
  }>(EXECUTE_EMAIL_IMPORT);

  // OPS-030: Classified import mutation
  const [executeClassifiedImportMutation, { loading: classifiedImportLoading }] = useMutation<{
    executeClassifiedImport: ClassifiedImportResult;
  }>(EXECUTE_CLASSIFIED_IMPORT);

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
      classificationPreview: null,
      classificationOverrides: [],
      excludedEmailIds: [],
    });
  }, []);

  // Go back one step
  const goBack = useCallback(() => {
    setState((prev) => {
      switch (prev.step) {
        case 'preview':
          return { ...prev, step: 'input' };
        case 'classify':
          return { ...prev, step: 'preview' };
        case 'assign':
          return hasMultipleCases && prev.classificationPreview
            ? { ...prev, step: 'classify' }
            : { ...prev, step: 'preview' };
        default:
          return prev;
      }
    });
  }, [hasMultipleCases]);

  // OPS-030: Load classification preview
  const loadClassificationPreview = useCallback(async () => {
    if (state.emailAddresses.length === 0) {
      return null;
    }

    try {
      const result = await fetchClassificationPreview({
        variables: {
          input: {
            caseId,
            emailAddresses: state.emailAddresses,
          },
        },
      });

      const preview = result.data?.previewClassificationForImport;
      if (preview && preview.totalEmails > 0) {
        setState((prev) => ({
          ...prev,
          step: 'classify',
          classificationPreview: preview,
        }));
        return preview;
      }

      // No classification needed - go to assign step
      setState((prev) => ({
        ...prev,
        step: 'assign',
      }));
      return null;
    } catch (err) {
      console.error('[useEmailImport] Classification preview error:', err);
      // Fall back to assign step on error
      setState((prev) => ({ ...prev, step: 'assign' }));
      return null;
    }
  }, [state.emailAddresses, caseId, fetchClassificationPreview]);

  // OPS-030: Override email classification
  const setClassificationOverride = useCallback((emailId: string, targetCaseId: string | null) => {
    setState((prev) => {
      if (targetCaseId === null) {
        // Remove override
        return {
          ...prev,
          classificationOverrides: prev.classificationOverrides.filter(
            (o) => o.emailId !== emailId
          ),
        };
      }

      const existing = prev.classificationOverrides.find((o) => o.emailId === emailId);
      if (existing) {
        return {
          ...prev,
          classificationOverrides: prev.classificationOverrides.map((o) =>
            o.emailId === emailId ? { ...o, caseId: targetCaseId } : o
          ),
        };
      }

      return {
        ...prev,
        classificationOverrides: [
          ...prev.classificationOverrides,
          { emailId, caseId: targetCaseId },
        ],
      };
    });
  }, []);

  // OPS-030: Exclude/include email from import
  const setEmailExcluded = useCallback((emailId: string, excluded: boolean) => {
    setState((prev) => {
      if (excluded) {
        if (prev.excludedEmailIds.includes(emailId)) return prev;
        return {
          ...prev,
          excludedEmailIds: [...prev.excludedEmailIds, emailId],
        };
      } else {
        return {
          ...prev,
          excludedEmailIds: prev.excludedEmailIds.filter((id) => id !== emailId),
        };
      }
    });
  }, []);

  // OPS-030: Go to assign step from classification
  const goToAssignFromClassification = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: 'assign',
    }));
  }, []);

  // OPS-030: Execute classified import
  const executeClassifiedImport = useCallback(async () => {
    setState((prev) => ({ ...prev, step: 'importing' }));

    try {
      // Build final overrides map from classification + user overrides
      const finalOverrides: ClassificationOverride[] = [];

      if (state.classificationPreview) {
        // Start with classification suggestions
        for (const classification of state.classificationPreview.classifications) {
          if (state.excludedEmailIds.includes(classification.emailId)) continue;

          // Check for user override
          const userOverride = state.classificationOverrides.find(
            (o) => o.emailId === classification.emailId
          );

          if (userOverride) {
            finalOverrides.push(userOverride);
          } else if (classification.suggestedCaseId) {
            finalOverrides.push({
              emailId: classification.emailId,
              caseId: classification.suggestedCaseId,
            });
          }
        }
      }

      const result = await executeClassifiedImportMutation({
        variables: {
          input: {
            caseId,
            emailAddresses: state.emailAddresses,
            classificationOverrides: finalOverrides,
            excludedEmailIds: state.excludedEmailIds,
            importAttachments: state.importAttachments,
            contactAssignments: state.contactAssignments,
          },
        },
      });

      const importResult = result.data?.executeClassifiedImport;

      console.log('[useEmailImport] Classified import result:', importResult);

      // Convert to standard result format
      const standardResult: EmailImportResult = {
        success: importResult?.success ?? false,
        emailsLinked: importResult?.totalEmailsImported ?? 0,
        contactsCreated:
          importResult?.importedByCase.reduce((sum, c) => sum + c.contactsCreated, 0) ?? 0,
        attachmentsImported: importResult?.totalAttachmentsImported ?? 0,
        errors: importResult?.errors ?? [],
      };

      setState((prev) => ({
        ...prev,
        step: 'complete',
        result: standardResult,
      }));

      return standardResult;
    } catch (err) {
      console.error('[useEmailImport] Classified import error:', err);
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
    state.classificationPreview,
    state.classificationOverrides,
    state.excludedEmailIds,
    state.importAttachments,
    state.contactAssignments,
    executeClassifiedImportMutation,
  ]);

  return {
    // State
    step: state.step,
    emailAddresses: state.emailAddresses,
    preview: state.preview,
    contactAssignments: state.contactAssignments,
    importAttachments: state.importAttachments,
    result: state.result,

    // OPS-030: Classification state
    hasMultipleCases,
    checkingMultipleCases,
    classificationPreview: state.classificationPreview,
    classificationOverrides: state.classificationOverrides,
    excludedEmailIds: state.excludedEmailIds,

    // Loading states
    previewLoading,
    importLoading: importLoading || classifiedImportLoading,
    classificationLoading,

    // Errors
    previewError,
    importError,
    classificationError,

    // Actions
    setEmailAddresses,
    loadPreview,
    updateContactAssignment,
    setImportAttachments,
    goToAssignStep,
    executeImport,
    reset,
    goBack,

    // OPS-030: Classification actions
    loadClassificationPreview,
    setClassificationOverride,
    setEmailExcluded,
    goToAssignFromClassification,
    executeClassifiedImport,

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
