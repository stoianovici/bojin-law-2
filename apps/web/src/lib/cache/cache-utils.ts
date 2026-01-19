/**
 * Apollo Cache Utilities
 *
 * Low-level helper functions for manipulating the Apollo cache.
 * These are used by the higher-level hooks (useDeleteMutation, useOptimisticMutation).
 */

import type { Reference } from '@apollo/client';
import { type EntityType, getEntityConfig, getCacheId } from './entity-registry';

// ============================================================================
// Types
// ============================================================================

export interface EvictOptions {
  /** Broadcast the eviction to trigger re-renders */
  broadcast?: boolean;
}

// Use a generic cache interface that matches Apollo's cache shape
interface CacheLike {
  evict: (options: { id: string; broadcast?: boolean }) => boolean;
  gc: () => string[];
  modify: (options: { id?: string; fields: Record<string, unknown> }) => boolean;
}

// ============================================================================
// Cache Eviction
// ============================================================================

/**
 * Evict an entity from the Apollo cache by its type and ID.
 * This completely removes the entity from the normalized cache.
 */
export function evictEntity(
  cache: CacheLike,
  entityType: EntityType,
  id: string,
  options: EvictOptions = {}
): boolean {
  const cacheId = getCacheId(entityType, id);
  const { broadcast = true } = options;

  const evicted = cache.evict({ id: cacheId, broadcast });

  if (evicted) {
    // Run garbage collection to clean up dangling references
    cache.gc();
  }

  return evicted;
}

/**
 * Evict multiple entities from the cache
 */
export function evictEntities(
  cache: CacheLike,
  entityType: EntityType,
  ids: string[],
  options: EvictOptions = {}
): number {
  let evictedCount = 0;

  for (const id of ids) {
    if (evictEntity(cache, entityType, id, { ...options, broadcast: false })) {
      evictedCount++;
    }
  }

  // Run garbage collection once after all evictions
  if (evictedCount > 0) {
    cache.gc();
  }

  return evictedCount;
}

// ============================================================================
// List Manipulation
// ============================================================================

/**
 * Remove an entity reference from a cached list.
 * Used when you want to update a list without refetching.
 *
 * @example
 * cache.modify({
 *   fields: {
 *     cases: (existingRefs, { readField }) =>
 *       removeFromList(existingRefs, deletedId, readField),
 *   },
 * });
 */
export function removeFromList<T extends Reference>(
  existingRefs: readonly T[],
  idToRemove: string,
  readField: (fieldName: string, ref: T) => unknown
): T[] {
  return existingRefs.filter((ref) => readField('id', ref) !== idToRemove);
}

/**
 * Add an entity reference to a cached list.
 * Used for optimistic updates when creating entities.
 */
export function addToList<T extends Reference>(
  existingRefs: readonly T[],
  newRef: T,
  position: 'start' | 'end' = 'end'
): T[] {
  if (position === 'start') {
    return [newRef, ...existingRefs];
  }
  return [...existingRefs, newRef];
}

/**
 * Update an entity in a cached list.
 * Returns the same list with the updated entity.
 */
export function updateInList<T extends Reference>(
  existingRefs: readonly T[],
  idToUpdate: string,
  updater: (ref: T) => T,
  readField: (fieldName: string, ref: T) => unknown
): T[] {
  return existingRefs.map((ref) => {
    if (readField('id', ref) === idToUpdate) {
      return updater(ref);
    }
    return ref;
  });
}

// ============================================================================
// Cache Modification Helpers
// ============================================================================

/**
 * Safely modify a field in the cache.
 * Returns true if the field was found and modified.
 */
export function modifyField<T>(
  cache: CacheLike,
  entityId: string,
  fieldName: string,
  modifier: (existing: T | undefined) => T
): boolean {
  try {
    return cache.modify({
      id: entityId,
      fields: {
        [fieldName]: modifier,
      },
    });
  } catch {
    // Field doesn't exist or cache error
    return false;
  }
}

/**
 * Update multiple fields on an entity in the cache.
 */
export function modifyEntity(
  cache: CacheLike,
  entityType: EntityType,
  id: string,
  updates: Record<string, unknown>
): boolean {
  const cacheId = getCacheId(entityType, id);

  try {
    return cache.modify({
      id: cacheId,
      fields: Object.fromEntries(Object.entries(updates).map(([key, value]) => [key, () => value])),
    });
  } catch {
    return false;
  }
}

// ============================================================================
// Privacy-Related Utilities
// ============================================================================

/**
 * Update the privacy status of an entity in the cache.
 * Used by useOptimisticMutation for privacy toggles.
 */
export function updatePrivacyStatus(
  cache: CacheLike,
  entityType: EntityType,
  id: string,
  isPrivate: boolean
): boolean {
  const config = getEntityConfig(entityType);
  if (!config.privacyField) {
    console.warn(`Entity type ${entityType} does not have a privacy field`);
    return false;
  }

  return modifyEntity(cache, entityType, id, {
    [config.privacyField]: isPrivate,
  });
}

// ============================================================================
// Query Refetch Helpers
// ============================================================================

/**
 * Create a refetch query config for use with useMutation's refetchQueries option.
 * This is a helper to build the refetchQueries array.
 */
export function createRefetchConfig(
  query: unknown,
  variables?: Record<string, unknown>
): { query: unknown; variables?: Record<string, unknown> } {
  if (variables) {
    return { query, variables };
  }
  return { query };
}

/**
 * Get query name from a DocumentNode for debugging
 */
export function getQueryName(query: unknown): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = query as any;
  const definition = doc?.definitions?.[0];
  if (definition?.kind === 'OperationDefinition' && definition.name) {
    return definition.name.value;
  }
  return undefined;
}
