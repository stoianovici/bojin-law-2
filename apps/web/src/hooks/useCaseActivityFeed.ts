/**
 * Case Activity Feed React Hooks
 * Story 4.6: Task Collaboration and Updates (AC: 2)
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// Types
interface User {
  id: string;
  firstName: string;
  lastName: string;
}

type CaseActivityType =
  | 'TaskCreated'
  | 'TaskStatusChanged'
  | 'TaskCompleted'
  | 'TaskAssigned'
  | 'TaskCommented'
  | 'DocumentUploaded'
  | 'DocumentVersioned'
  | 'CommunicationReceived'
  | 'CommunicationSent'
  | 'DeadlineApproaching'
  | 'MilestoneReached';

type EntityType = 'Task' | 'Document' | 'Communication';

interface CaseActivityEntry {
  id: string;
  caseId: string;
  actorId: string;
  actor: User;
  activityType: CaseActivityType;
  entityType: EntityType;
  entityId: string;
  title: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface CaseActivityFeedResponse {
  entries: CaseActivityEntry[];
  hasMore: boolean;
  nextCursor?: string;
}

// GraphQL Fragments
const ACTIVITY_FRAGMENT = gql`
  fragment ActivityFields on CaseActivityEntry {
    id
    caseId
    actorId
    actor {
      id
      firstName
      lastName
    }
    activityType
    entityType
    entityId
    title
    summary
    metadata
    createdAt
  }
`;

// Queries
const GET_CASE_ACTIVITY_FEED = gql`
  ${ACTIVITY_FRAGMENT}
  query GetCaseActivityFeed($caseId: ID!, $options: FeedOptionsInput) {
    caseActivityFeed(caseId: $caseId, options: $options) {
      entries {
        ...ActivityFields
      }
      hasMore
      nextCursor
    }
  }
`;

// Input interfaces
export interface FeedOptions {
  limit?: number;
  cursor?: string;
  activityTypes?: CaseActivityType[];
  since?: string;
  until?: string;
}

// Custom Hooks

/**
 * Hook to get activity feed for a case
 */
export function useCaseActivityFeed(caseId: string, options?: FeedOptions) {
  return useQuery<{ caseActivityFeed: CaseActivityFeedResponse }>(GET_CASE_ACTIVITY_FEED, {
    variables: { caseId, options },
    skip: !caseId,
  });
}

/**
 * Get human-readable description for an activity type
 */
export function getActivityTypeLabel(activityType: CaseActivityType): string {
  const labels: Record<CaseActivityType, string> = {
    TaskCreated: 'Sarcină nouă',
    TaskStatusChanged: 'Status schimbat',
    TaskCompleted: 'Sarcină finalizată',
    TaskAssigned: 'Sarcină asignată',
    TaskCommented: 'Comentariu nou',
    DocumentUploaded: 'Document încărcat',
    DocumentVersioned: 'Versiune nouă document',
    CommunicationReceived: 'Comunicare primită',
    CommunicationSent: 'Comunicare trimisă',
    DeadlineApproaching: 'Termen aproape',
    MilestoneReached: 'Reper atins',
  };
  return labels[activityType] || activityType;
}

/**
 * Get icon for an activity type
 */
export function getActivityTypeIcon(activityType: CaseActivityType): string {
  const icons: Record<CaseActivityType, string> = {
    TaskCreated: '➕',
    TaskStatusChanged: '🔄',
    TaskCompleted: '✅',
    TaskAssigned: '👤',
    TaskCommented: '💬',
    DocumentUploaded: '📄',
    DocumentVersioned: '📑',
    CommunicationReceived: '📥',
    CommunicationSent: '📤',
    DeadlineApproaching: '⏰',
    MilestoneReached: '🎯',
  };
  return icons[activityType] || '📌';
}

/**
 * Get color class for an activity type
 */
export function getActivityTypeColor(activityType: CaseActivityType): string {
  const colors: Record<CaseActivityType, string> = {
    TaskCreated: 'text-blue-600 bg-blue-50',
    TaskStatusChanged: 'text-yellow-600 bg-yellow-50',
    TaskCompleted: 'text-green-600 bg-green-50',
    TaskAssigned: 'text-purple-600 bg-purple-50',
    TaskCommented: 'text-gray-600 bg-gray-50',
    DocumentUploaded: 'text-indigo-600 bg-indigo-50',
    DocumentVersioned: 'text-indigo-600 bg-indigo-50',
    CommunicationReceived: 'text-teal-600 bg-teal-50',
    CommunicationSent: 'text-teal-600 bg-teal-50',
    DeadlineApproaching: 'text-orange-600 bg-orange-50',
    MilestoneReached: 'text-emerald-600 bg-emerald-50',
  };
  return colors[activityType] || 'text-gray-600 bg-gray-50';
}

export type { CaseActivityEntry, CaseActivityType, EntityType, CaseActivityFeedResponse };
