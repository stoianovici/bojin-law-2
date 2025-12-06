'use client';

/**
 * Document Lock Status Component
 * Story 3.4: Word Integration with Live AI Assistance
 *
 * Displays the current lock status of a document with user info and expiry.
 */

import React from 'react';
import { useQuery, useSubscription } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Lock, Unlock, Clock, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// GraphQL Operations
const GET_DOCUMENT_LOCK_STATUS = gql`
  query GetDocumentLockStatus($documentId: UUID!) {
    documentLockStatus(documentId: $documentId) {
      isLocked
      currentUserHoldsLock
      lock {
        id
        user {
          id
          firstName
          lastName
          email
        }
        lockedAt
        expiresAt
        sessionType
      }
    }
  }
`;

const DOCUMENT_LOCK_CHANGED = gql`
  subscription OnDocumentLockChanged($documentId: UUID!) {
    documentLockChanged(documentId: $documentId) {
      isLocked
      currentUserHoldsLock
      lock {
        id
        user {
          id
          firstName
          lastName
          email
        }
        lockedAt
        expiresAt
        sessionType
      }
    }
  }
`;

interface DocumentLockStatusProps {
  documentId: string;
  variant?: 'badge' | 'detailed' | 'compact';
  className?: string;
}

interface LockUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface DocumentLock {
  id: string;
  user: LockUser;
  lockedAt: string;
  expiresAt: string;
  sessionType: string;
}

interface DocumentLockStatusData {
  documentLockStatus: {
    isLocked: boolean;
    currentUserHoldsLock: boolean;
    lock?: DocumentLock;
  };
}

export function DocumentLockStatus({
  documentId,
  variant = 'badge',
  className,
}: DocumentLockStatusProps) {
  // Query lock status
  const { data, loading, error, refetch } = useQuery<DocumentLockStatusData>(GET_DOCUMENT_LOCK_STATUS, {
    variables: { documentId },
    pollInterval: 60000, // Poll every minute as backup
  });

  // Subscribe to lock changes
  useSubscription(DOCUMENT_LOCK_CHANGED, {
    variables: { documentId },
    onData: () => {
      refetch();
    },
  });

  if (loading) {
    return (
      <Badge variant="outline" className={className}>
        <Clock className="h-3 w-3 mr-1 animate-pulse" />
        Checking...
      </Badge>
    );
  }

  if (error) {
    return null;
  }

  const { isLocked, currentUserHoldsLock, lock } = data?.documentLockStatus || {};

  if (!isLocked) {
    if (variant === 'compact') {
      return null;
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`text-green-600 border-green-200 ${className}`}>
              <Unlock className="h-3 w-3 mr-1" />
              {variant === 'badge' ? 'Available' : 'Document is available for editing'}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>This document is not currently being edited</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Document is locked
  const lockedBy = lock?.user;
  const userInitials = lockedBy
    ? `${lockedBy.firstName?.[0] || ''}${lockedBy.lastName?.[0] || ''}`
    : '??';
  const userName = lockedBy
    ? `${lockedBy.firstName} ${lockedBy.lastName}`
    : 'Unknown User';
  const expiresAt = lock?.expiresAt ? new Date(lock.expiresAt) : null;
  const expiresIn = expiresAt ? formatDistanceToNow(expiresAt, { addSuffix: true }) : '';

  const sessionTypeLabels: Record<string, string> = {
    WORD_DESKTOP: 'Word Desktop',
    WORD_ONLINE: 'Word Online',
    PLATFORM: 'Platform Editor',
  };
  const sessionTypeLabel = sessionTypeLabels[lock?.sessionType || 'PLATFORM'];

  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={currentUserHoldsLock ? 'default' : 'secondary'}
              className={`${currentUserHoldsLock ? 'bg-blue-500' : 'bg-orange-100 text-orange-700 border-orange-200'} ${className}`}
            >
              <Lock className="h-3 w-3 mr-1" />
              {currentUserHoldsLock ? 'You' : userInitials}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{currentUserHoldsLock ? 'You are editing this document' : `Locked by ${userName}`}</p>
            <p className="text-xs text-muted-foreground">via {sessionTypeLabel}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'badge') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={currentUserHoldsLock ? 'default' : 'secondary'}
              className={`${currentUserHoldsLock ? 'bg-blue-500' : 'bg-orange-100 text-orange-700 border-orange-200'} ${className}`}
            >
              <Lock className="h-3 w-3 mr-1" />
              {currentUserHoldsLock ? 'Editing' : `Locked by ${lockedBy?.firstName || 'User'}`}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p>{currentUserHoldsLock ? 'You are editing this document' : `Locked by ${userName}`}</p>
              <p className="text-xs text-muted-foreground">via {sessionTypeLabel}</p>
              {expiresAt && (
                <p className="text-xs text-muted-foreground">Lock expires {expiresIn}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Detailed variant
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${currentUserHoldsLock ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50'} ${className}`}>
      <Avatar className="h-8 w-8">
        <AvatarFallback className={currentUserHoldsLock ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white'}>
          {currentUserHoldsLock ? <User className="h-4 w-4" /> : userInitials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Lock className={`h-4 w-4 ${currentUserHoldsLock ? 'text-blue-500' : 'text-orange-500'}`} />
          <span className="font-medium text-sm">
            {currentUserHoldsLock ? 'You are editing' : `Locked by ${userName}`}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span>{sessionTypeLabel}</span>
          {expiresAt && (
            <>
              <span>·</span>
              <span>Expires {expiresIn}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default DocumentLockStatus;
