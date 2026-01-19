/**
 * Cache Management Hooks
 *
 * Provides hooks for managing Apollo cache during mutations.
 * Use these hooks instead of raw useMutation for proper cache invalidation.
 *
 * @example
 * // For deletions
 * import { useDeleteCase, useDeleteClient, useDeleteDocument } from '@/hooks/cache';
 *
 * // For privacy toggles
 * import { useDocumentPrivacy, useEmailPrivacy } from '@/hooks/cache';
 */

// ============================================================================
// Base Hooks (for building custom entity hooks)
// ============================================================================

export {
  useDeleteMutation,
  type UseDeleteMutationOptions,
  type UseDeleteMutationResult,
  type DeleteVariables,
} from './useDeleteMutation';

export {
  useOptimisticMutation,
  createPrivacyToggleHook,
  type UseOptimisticMutationOptions,
  type UseOptimisticMutationResult,
  type CreatePrivacyToggleOptions,
  type PrivacyToggleResult,
} from './useOptimisticMutation';

// ============================================================================
// Entity-Specific Delete Hooks
// ============================================================================

export {
  useDeleteCase,
  type UseDeleteCaseOptions,
  type UseDeleteCaseResult,
} from './useDeleteCase';

export {
  useDeleteClient,
  type UseDeleteClientOptions,
  type UseDeleteClientResult,
} from './useDeleteClient';

export {
  useDeleteDocument,
  type UseDeleteDocumentOptions,
  type UseDeleteDocumentResult,
} from './useDeleteDocument';

// ============================================================================
// Privacy Toggle Hooks
// ============================================================================

export {
  useDocumentPrivacy,
  type UseDocumentPrivacyOptions,
  type UseDocumentPrivacyResult,
} from './useDocumentPrivacy';

export {
  useEmailPrivacy,
  type UseEmailPrivacyOptions,
  type UseEmailPrivacyResult,
} from './useEmailPrivacy';
