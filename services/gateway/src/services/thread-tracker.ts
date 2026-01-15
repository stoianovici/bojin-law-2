/**
 * Thread Tracker Service
 *
 * Tracks email thread assignments and returns where a thread was previously classified.
 * Thread continuity is ABSOLUTE certainty - if a thread match is found, the new email
 * should follow the same assignment.
 */

import { prisma } from '@legal-platform/database';
import { EmailClassificationState } from '@prisma/client';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a match found for an email thread's existing classification.
 * If returned, the new email should follow this assignment with absolute certainty.
 */
export interface ThreadMatch {
  /** The case ID the thread is assigned to (if any) */
  caseId?: string;
  /** The case number for display purposes */
  caseNumber?: string;
  /** The client ID the thread is assigned to (if any) */
  clientId?: string;
  /** The client name for display purposes */
  clientName?: string;
  /** The email ID that established this thread's assignment */
  sourceEmailId: string;
  /** When the source email was classified */
  classifiedAt: Date;
}

// ============================================================================
// Thread Tracker Service
// ============================================================================

export class ThreadTrackerService {
  /**
   * Find existing classification for an email thread.
   *
   * Given a conversationId, checks if any email in that thread has already
   * been classified. If found, returns the classification details so the
   * new email can follow the same assignment.
   *
   * Thread continuity is absolute - if a match is found, use it without
   * further classification logic.
   *
   * @param conversationId - The Microsoft Graph conversation ID
   * @param firmId - The firm ID to scope the search
   * @returns ThreadMatch if found, null otherwise
   */
  async findThreadClassification(
    conversationId: string,
    firmId: string
  ): Promise<ThreadMatch | null> {
    if (!conversationId) {
      logger.warn('findThreadClassification called without conversationId');
      return null;
    }

    logger.debug('Looking for thread classification', { conversationId, firmId });

    try {
      // Query for emails in the same thread that are classified
      const classifiedEmail = await prisma.email.findFirst({
        where: {
          conversationId,
          firmId,
          classificationState: EmailClassificationState.Classified,
          classifiedAt: { not: null },
        },
        orderBy: {
          classifiedAt: 'desc',
        },
        select: {
          id: true,
          caseId: true,
          clientId: true,
          classifiedAt: true,
          case: {
            select: {
              id: true,
              caseNumber: true,
            },
          },
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!classifiedEmail) {
        logger.debug('No classified email found in thread', { conversationId });
        return null;
      }

      const match: ThreadMatch = {
        sourceEmailId: classifiedEmail.id,
        classifiedAt: classifiedEmail.classifiedAt!,
      };

      // Add case information if available
      if (classifiedEmail.caseId && classifiedEmail.case) {
        match.caseId = classifiedEmail.case.id;
        match.caseNumber = classifiedEmail.case.caseNumber;
      }

      // Add client information if available
      if (classifiedEmail.clientId && classifiedEmail.client) {
        match.clientId = classifiedEmail.client.id;
        match.clientName = classifiedEmail.client.name;
      }

      logger.info('Found thread classification', {
        conversationId,
        sourceEmailId: match.sourceEmailId,
        caseId: match.caseId,
        clientId: match.clientId,
      });

      return match;
    } catch (error) {
      logger.error('Error finding thread classification', {
        conversationId,
        firmId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if a conversation has any classified emails.
   *
   * A lighter-weight check that just returns whether a thread
   * has been classified, without fetching all the details.
   *
   * @param conversationId - The Microsoft Graph conversation ID
   * @param firmId - The firm ID to scope the search
   * @returns true if the thread has classified emails, false otherwise
   */
  async hasThreadClassification(conversationId: string, firmId: string): Promise<boolean> {
    if (!conversationId) {
      return false;
    }

    try {
      const count = await prisma.email.count({
        where: {
          conversationId,
          firmId,
          classificationState: EmailClassificationState.Classified,
          classifiedAt: { not: null },
        },
      });

      return count > 0;
    } catch (error) {
      logger.error('Error checking thread classification existence', {
        conversationId,
        firmId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get all emails in a thread with their classification states.
   *
   * Useful for debugging or displaying thread history.
   *
   * @param conversationId - The Microsoft Graph conversation ID
   * @param firmId - The firm ID to scope the search
   * @returns Array of emails with classification info
   */
  async getThreadEmails(
    conversationId: string,
    firmId: string
  ): Promise<
    Array<{
      id: string;
      subject: string;
      classificationState: EmailClassificationState;
      classifiedAt: Date | null;
      caseId: string | null;
      clientId: string | null;
      receivedDateTime: Date;
    }>
  > {
    if (!conversationId) {
      return [];
    }

    try {
      const emails = await prisma.email.findMany({
        where: {
          conversationId,
          firmId,
        },
        select: {
          id: true,
          subject: true,
          classificationState: true,
          classifiedAt: true,
          caseId: true,
          clientId: true,
          receivedDateTime: true,
        },
        orderBy: {
          receivedDateTime: 'asc',
        },
      });

      return emails;
    } catch (error) {
      logger.error('Error getting thread emails', {
        conversationId,
        firmId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let threadTrackerServiceInstance: ThreadTrackerService | null = null;

/**
 * Get the singleton ThreadTrackerService instance.
 *
 * @returns ThreadTrackerService instance
 */
export function getThreadTrackerService(): ThreadTrackerService {
  if (!threadTrackerServiceInstance) {
    threadTrackerServiceInstance = new ThreadTrackerService();
  }
  return threadTrackerServiceInstance;
}

export const threadTrackerService = getThreadTrackerService();
