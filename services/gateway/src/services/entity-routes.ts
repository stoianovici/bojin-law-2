/**
 * Entity Route Registry
 *
 * Centralized mapping of entity types to frontend routes.
 * Supports anchor-to-parent linking pattern where child entities
 * (tasks, documents, events) link to their parent (case) or
 * contextual view (calendar for tasks/deadlines).
 */

import type { StoryEntityType } from './firm-operations.types';

// ============================================================================
// Types
// ============================================================================

export interface EntityRouteContext {
  entityId: string;
  parentId?: string;
  dueDate?: string; // ISO date string for calendar linking
}

type RouteGenerator = (ctx: EntityRouteContext) => string | undefined;

// ============================================================================
// Validation Helpers
// ============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate UUID format.
 */
export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

/**
 * Validate Microsoft Graph conversation ID (base64 or URL-safe base64).
 * Graph IDs are base64-encoded, typically 40-250 chars.
 * Supports both standard (+/) and URL-safe (-_) base64 alphabets.
 */
export function isValidGraphConversationId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  // Standard base64: A-Za-z0-9+/=
  // URL-safe base64: A-Za-z0-9-_=
  const base64Regex = /^[A-Za-z0-9+/=_-]{20,300}$/;
  return base64Regex.test(id);
}

/**
 * Validate ISO date string (YYYY-MM-DD).
 */
function isValidISODate(date: string): boolean {
  if (!date) return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

// ============================================================================
// Route Registry
// ============================================================================

/**
 * Route generators for each entity type.
 * Returns undefined if required context is missing or invalid.
 */
const ENTITY_ROUTES: Record<StoryEntityType, RouteGenerator> = {
  // Direct page routes
  case: ({ entityId }) => {
    if (!isValidUUID(entityId)) return undefined;
    return `/cases/${entityId}/edit`;
  },

  email_thread: ({ entityId }) => {
    if (!isValidGraphConversationId(entityId)) return undefined;
    return `/email?thread=${encodeURIComponent(entityId)}`;
  },

  // Calendar-based routes (tasks and deadlines navigate to calendar date)
  task: ({ dueDate }) => {
    if (dueDate && isValidISODate(dueDate)) {
      return `/calendar?date=${dueDate}`;
    }
    return '/calendar';
  },

  deadline: ({ dueDate }) => {
    if (dueDate && isValidISODate(dueDate)) {
      return `/calendar?date=${dueDate}`;
    }
    return '/calendar';
  },

  // Filtered list views
  client: ({ entityId }) => {
    if (!isValidUUID(entityId)) return undefined;
    return `/cases?client=${entityId}`;
  },

  user: ({ entityId }) => {
    if (!isValidUUID(entityId)) return undefined;
    return `/tasks?assignee=${entityId}`;
  },

  // Fall back to parent case
  document: ({ parentId }) => {
    if (parentId && isValidUUID(parentId)) {
      return `/cases/${parentId}/edit`;
    }
    return undefined;
  },

  event: ({ parentId }) => {
    if (parentId && isValidUUID(parentId)) {
      return `/cases/${parentId}/edit`;
    }
    return undefined;
  },
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate href for an entity based on its type and context.
 *
 * @param entityType - The type of entity
 * @param entityId - The entity's own ID
 * @param options - Additional context (parentId, dueDate)
 * @returns The href string or undefined if invalid/not navigable
 *
 * @example
 * // Case - direct link
 * generateEntityHref('case', 'uuid-123')
 * // => '/cases/uuid-123/edit'
 *
 * @example
 * // Task with due date - calendar link
 * generateEntityHref('task', 'task-uuid', { dueDate: '2026-02-03' })
 * // => '/calendar?date=2026-02-03'
 *
 * @example
 * // Document with parent case - case link
 * generateEntityHref('document', 'doc-uuid', { parentId: 'case-uuid' })
 * // => '/cases/case-uuid/edit'
 *
 * @example
 * // Email thread - encoded thread ID
 * generateEntityHref('email_thread', 'AAQkADg3OT...')
 * // => '/email?thread=AAQkADg3OT...'
 */
export function generateEntityHref(
  entityType: string,
  entityId: string,
  options?: { parentId?: string; dueDate?: string }
): string | undefined {
  const type = entityType.toLowerCase() as StoryEntityType;
  const generator = ENTITY_ROUTES[type];

  if (!generator) {
    return undefined;
  }

  return generator({
    entityId,
    parentId: options?.parentId,
    dueDate: options?.dueDate,
  });
}

/**
 * Validate that an entity ID is valid for its type.
 */
export function isValidEntityId(entityType: string, entityId: string): boolean {
  if (!entityType || !entityId) return false;

  const type = entityType.toLowerCase();

  switch (type) {
    case 'email_thread':
      return isValidGraphConversationId(entityId);
    case 'case':
    case 'client':
    case 'user':
    case 'task':
    case 'document':
    case 'event':
    case 'deadline':
      return isValidUUID(entityId);
    default:
      return false;
  }
}

/**
 * Check if an href is valid (not empty, not just '#').
 */
export function isValidHref(href?: string): boolean {
  return !!href && href !== '#' && href !== '';
}
