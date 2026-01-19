/**
 * Apollo Cache Management Library
 *
 * Provides utilities for consistent cache invalidation across the application.
 *
 * @example
 * import { entityRegistry, evictEntity, getCacheId } from '@/lib/cache';
 */

export {
  type EntityType,
  type EntityConfig,
  entityRegistry,
  getEntityConfig,
  getCacheId,
  getListQueries,
  hasPrivacyField,
  getPrivacyField,
} from './entity-registry';

export {
  type EvictOptions,
  evictEntity,
  evictEntities,
  removeFromList,
  addToList,
  updateInList,
  modifyField,
  modifyEntity,
  updatePrivacyStatus,
  createRefetchConfig,
  getQueryName,
} from './cache-utils';
