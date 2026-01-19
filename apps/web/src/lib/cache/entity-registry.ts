/**
 * Entity Registry for Apollo Cache Invalidation
 *
 * Maps each entity type to its GraphQL typename and the queries
 * that need to be invalidated when the entity is modified/deleted.
 */

import { DocumentNode } from 'graphql';
import {
  GET_CASES,
  GET_CASE,
  SEARCH_CASES,
  GET_PENDING_CASES,
  GET_CLIENTS,
  GET_CLIENTS_WITH_CASES,
  SEARCH_CLIENTS,
  GET_CASE_DOCUMENTS,
  GET_CLIENT_INBOX_DOCUMENTS,
  GET_ALL_DOCUMENTS,
  GET_EMAILS_BY_CASE,
  GET_EMAIL_THREAD,
  GET_COURTS,
  GET_PERSONAL_CONTACTS,
} from '@/graphql/queries';

// ============================================================================
// Types
// ============================================================================

export type EntityType =
  | 'Case'
  | 'Client'
  | 'Document'
  | 'Email'
  | 'EmailThread'
  | 'Task'
  | 'Court'
  | 'PersonalContact';

export interface EntityConfig {
  /** GraphQL __typename for cache identification */
  typename: string;
  /** Queries that show lists of this entity (to be refetched on delete) */
  listQueries: DocumentNode[];
  /** Queries that show a single entity (to be evicted on delete) */
  detailQueries?: DocumentNode[];
  /** Related entity types whose queries might need refresh */
  relatedEntities?: EntityType[];
  /** Field name used for privacy filtering (if applicable) */
  privacyField?: string;
}

// ============================================================================
// Entity Registry
// ============================================================================

export const entityRegistry: Record<EntityType, EntityConfig> = {
  Case: {
    typename: 'Case',
    listQueries: [GET_CASES, SEARCH_CASES, GET_PENDING_CASES],
    detailQueries: [GET_CASE],
    relatedEntities: ['Client', 'Document', 'Task'],
  },

  Client: {
    typename: 'Client',
    listQueries: [GET_CLIENTS, GET_CLIENTS_WITH_CASES, SEARCH_CLIENTS],
    relatedEntities: ['Case', 'Document'],
  },

  Document: {
    typename: 'Document',
    listQueries: [GET_CASE_DOCUMENTS, GET_CLIENT_INBOX_DOCUMENTS, GET_ALL_DOCUMENTS],
    relatedEntities: ['Case'],
    privacyField: 'isPrivate',
  },

  Email: {
    typename: 'Email',
    listQueries: [GET_EMAILS_BY_CASE],
    detailQueries: [GET_EMAIL_THREAD],
    relatedEntities: ['EmailThread'],
    privacyField: 'isPrivate',
  },

  EmailThread: {
    typename: 'EmailThread',
    listQueries: [GET_EMAILS_BY_CASE],
    detailQueries: [GET_EMAIL_THREAD],
    relatedEntities: ['Email'],
    privacyField: 'isPrivate',
  },

  Task: {
    typename: 'Task',
    listQueries: [], // Tasks have dynamic variables, handled differently
    relatedEntities: ['Case'],
  },

  Court: {
    typename: 'GlobalEmailSource',
    listQueries: [GET_COURTS],
  },

  PersonalContact: {
    typename: 'PersonalContact',
    listQueries: [GET_PERSONAL_CONTACTS],
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the entity config for a given entity type
 */
export function getEntityConfig(entityType: EntityType): EntityConfig {
  const config = entityRegistry[entityType];
  if (!config) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }
  return config;
}

/**
 * Get the Apollo cache ID for an entity
 */
export function getCacheId(entityType: EntityType, id: string): string {
  const config = getEntityConfig(entityType);
  return `${config.typename}:${id}`;
}

/**
 * Get all list queries for an entity type (including related entities)
 */
export function getListQueries(entityType: EntityType, includeRelated = false): DocumentNode[] {
  const config = getEntityConfig(entityType);
  const queries = [...config.listQueries];

  if (includeRelated && config.relatedEntities) {
    for (const relatedType of config.relatedEntities) {
      const relatedConfig = entityRegistry[relatedType];
      if (relatedConfig) {
        queries.push(...relatedConfig.listQueries);
      }
    }
  }

  // Remove duplicates
  return [...new Set(queries)];
}

/**
 * Check if an entity type has a privacy field
 */
export function hasPrivacyField(entityType: EntityType): boolean {
  const config = getEntityConfig(entityType);
  return !!config.privacyField;
}

/**
 * Get the privacy field name for an entity type
 */
export function getPrivacyField(entityType: EntityType): string | undefined {
  const config = getEntityConfig(entityType);
  return config.privacyField;
}
