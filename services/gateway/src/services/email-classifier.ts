/**
 * Email Classifier Pipeline
 *
 * Routes incoming emails to one of 5 destinations based on sender,
 * thread continuity, court reference matching, and contact association.
 *
 * Classification Flow:
 * 1. Check filter list (PersonalContact) -> Ignored
 * 2. Check thread continuity -> Follow existing classification
 * 3. Check court source (GlobalEmailSource) -> CourtUnassigned or Classified
 * 4. Check contact match -> Classified, ClientInbox, or Uncertain
 */

import { prisma } from '@legal-platform/database';
import { EmailClassificationState, CaseStatus, GlobalEmailSourceCategory } from '@prisma/client';
import logger from '../utils/logger';
import { threadTrackerService } from './thread-tracker';
import { contactMatcherService } from './contact-matcher';
import { extractReferences, matchesCase } from './reference-extractor';
import { personalContactService } from './personal-contact.service';

// ============================================================================
// Types
// ============================================================================

/**
 * Email data required for classification
 */
export interface EmailForClassification {
  /** Unique email identifier */
  id: string;
  /** Microsoft Graph conversation ID for thread tracking */
  conversationId: string;
  /** Email subject line */
  subject: string;
  /** Preview of email body */
  bodyPreview: string;
  /** Full email body content (HTML or text) */
  bodyContent?: string;
  /** Sender information */
  from: { name?: string; address: string };
  /** Primary recipients */
  toRecipients: Array<{ name?: string; address: string }>;
  /** CC recipients */
  ccRecipients?: Array<{ name?: string; address: string }>;
  /** When the email was received */
  receivedDateTime: Date;
  /** Folder the email is in (e.g., 'Inbox', 'Sent Items', 'Elemente trimise') */
  parentFolderName?: string;
}

/**
 * How the classification match was determined
 */
export type ClassificationMatchType =
  | 'THREAD'
  | 'REFERENCE'
  | 'CONTACT'
  | 'DOMAIN'
  | 'FILTERED'
  | 'UNKNOWN';

/**
 * Result of classifying an email
 */
export interface ClassificationResult {
  /** The classification state/destination */
  state: EmailClassificationState;
  /** Case ID if email was assigned to a case */
  caseId: string | null;
  /** Client ID if email was associated with a client */
  clientId: string | null;
  /** Confidence level (1.0 for thread/reference, 0.9 for HIGH contact, 0.5 for LOW) */
  confidence: number;
  /** Human-readable explanation of the classification */
  reason: string;
  /** How the match was determined */
  matchType: ClassificationMatchType;
}

// ============================================================================
// Constants
// ============================================================================

/** Sent folder names (English and Romanian) */
const SENT_FOLDER_NAMES = ['Sent Items', 'Elemente trimise', 'Sent'];

/** Confidence levels */
const CONFIDENCE = {
  ABSOLUTE: 1.0, // Thread continuity, reference match
  HIGH: 0.9, // Single case contact match
  LOW: 0.5, // Multiple case contact match
  NONE: 0.0, // Unknown sender
} as const;

// ============================================================================
// Email Classifier Service
// ============================================================================

/**
 * Service for classifying incoming emails into appropriate destinations
 */
export class EmailClassifierService {
  /**
   * Classify an email to determine its destination.
   *
   * @param email - The email to classify
   * @param firmId - The firm ID context
   * @param userId - The user ID who owns the mailbox
   * @returns Classification result with state, case/client IDs, and reasoning
   */
  async classifyEmail(
    email: EmailForClassification,
    firmId: string,
    userId: string
  ): Promise<ClassificationResult> {
    logger.debug('Starting email classification', {
      emailId: email.id,
      subject: email.subject.substring(0, 50),
      firmId,
    });

    // Determine if this is a sent email (classify by recipients instead of sender)
    const isSentEmail = this.isSentEmail(email.parentFolderName);

    // Get the relevant email addresses for classification
    const classificationAddresses = isSentEmail
      ? this.getRecipientAddresses(email)
      : [email.from.address];

    // ========================================================================
    // Step 1: Check filter list (PersonalContact)
    // ========================================================================
    const filterResult = await this.checkFilterList(classificationAddresses, userId, isSentEmail);
    if (filterResult) {
      logger.info('Email classified as Ignored (filtered contact)', {
        emailId: email.id,
      });
      return filterResult;
    }

    // ========================================================================
    // Step 2: Check thread continuity
    // ========================================================================
    const threadResult = await this.checkThreadContinuity(email.conversationId, firmId);
    if (threadResult) {
      logger.info('Email classified by thread continuity', {
        emailId: email.id,
        state: threadResult.state,
        caseId: threadResult.caseId,
      });
      return threadResult;
    }

    // ========================================================================
    // Step 3: Check if from court (GlobalEmailSource)
    // ========================================================================
    const courtResult = await this.checkCourtSource(classificationAddresses, email, firmId);
    if (courtResult) {
      logger.info('Email classified as court email', {
        emailId: email.id,
        state: courtResult.state,
        caseId: courtResult.caseId,
      });
      return courtResult;
    }

    // ========================================================================
    // Step 4: Check contact match
    // ========================================================================
    const contactResult = await this.checkContactMatch(classificationAddresses, firmId);

    logger.info('Email classification complete', {
      emailId: email.id,
      state: contactResult.state,
      caseId: contactResult.caseId,
      clientId: contactResult.clientId,
      matchType: contactResult.matchType,
    });

    return contactResult;
  }

  // ============================================================================
  // Private Methods - Classification Steps
  // ============================================================================

  /**
   * Step 1: Check if sender is in the user's personal contact filter list.
   * Personal contacts are blocked from appearing in the firm's email workflow.
   */
  private async checkFilterList(
    addresses: string[],
    userId: string,
    isSentEmail: boolean
  ): Promise<ClassificationResult | null> {
    // For sent emails, we don't filter - user intentionally sent to these addresses
    if (isSentEmail) {
      return null;
    }

    // Check each address against the filter list
    for (const address of addresses) {
      const isFiltered = await personalContactService.isPersonalContact(userId, address);

      if (isFiltered) {
        return {
          state: EmailClassificationState.Ignored,
          caseId: null,
          clientId: null,
          confidence: CONFIDENCE.ABSOLUTE,
          reason: `Sender ${address} is in personal contacts filter list`,
          matchType: 'FILTERED',
        };
      }
    }

    return null;
  }

  /**
   * Step 2: Check if this email belongs to an existing classified thread.
   * Thread continuity has absolute certainty - follow the existing assignment.
   */
  private async checkThreadContinuity(
    conversationId: string,
    firmId: string
  ): Promise<ClassificationResult | null> {
    if (!conversationId) {
      return null;
    }

    const threadMatch = await threadTrackerService.findThreadClassification(conversationId, firmId);

    if (!threadMatch) {
      return null;
    }

    // Thread found - follow the same classification
    if (threadMatch.caseId) {
      return {
        state: EmailClassificationState.Classified,
        caseId: threadMatch.caseId,
        clientId: threadMatch.clientId || null,
        confidence: CONFIDENCE.ABSOLUTE,
        reason: `Thread previously assigned to case ${threadMatch.caseNumber || threadMatch.caseId}`,
        matchType: 'THREAD',
      };
    }

    // Thread exists but only has client association (ClientInbox scenario)
    if (threadMatch.clientId) {
      return {
        state: EmailClassificationState.ClientInbox,
        caseId: null,
        clientId: threadMatch.clientId,
        confidence: CONFIDENCE.ABSOLUTE,
        reason: `Thread previously assigned to client ${threadMatch.clientName || threadMatch.clientId}`,
        matchType: 'THREAD',
      };
    }

    return null;
  }

  /**
   * Step 3: Check if email is from a court or other global source.
   * Court emails are matched by reference numbers in the subject/body.
   */
  private async checkCourtSource(
    addresses: string[],
    email: EmailForClassification,
    firmId: string
  ): Promise<ClassificationResult | null> {
    // Check each address against GlobalEmailSource
    for (const address of addresses) {
      const senderDomain = this.extractDomain(address);
      const normalizedEmail = address.toLowerCase().trim();

      const courtSource = await prisma.globalEmailSource.findFirst({
        where: {
          firmId,
          category: GlobalEmailSourceCategory.Court,
          OR: [
            { emails: { has: normalizedEmail } },
            ...(senderDomain ? [{ domains: { has: senderDomain } }] : []),
          ],
        },
      });

      if (courtSource) {
        // Court source found - try to match by reference number
        const references = extractReferences(email.subject, email.bodyContent || email.bodyPreview);

        if (references.length > 0) {
          // Try to find a matching case
          const matchedCase = await this.findCaseByReferences(
            references.map((r) => r.value),
            firmId
          );

          if (matchedCase) {
            return {
              state: EmailClassificationState.Classified,
              caseId: matchedCase.id,
              clientId: matchedCase.clientId,
              confidence: CONFIDENCE.ABSOLUTE,
              reason: `Court email matched case ${matchedCase.caseNumber} by reference number`,
              matchType: 'REFERENCE',
            };
          }
        }

        // Court email but no reference match - goes to CourtUnassigned
        return {
          state: EmailClassificationState.CourtUnassigned,
          caseId: null,
          clientId: null,
          confidence: CONFIDENCE.ABSOLUTE,
          reason: `Court email from ${courtSource.name}, no matching reference number found`,
          matchType: 'REFERENCE',
        };
      }
    }

    return null;
  }

  /**
   * Step 4: Check contact match to determine client/case association.
   */
  private async checkContactMatch(
    addresses: string[],
    firmId: string
  ): Promise<ClassificationResult> {
    // Try each address for a contact match
    for (const address of addresses) {
      const contactMatch = await contactMatcherService.findContactMatch(address, firmId);

      if (contactMatch.certainty === 'HIGH' && contactMatch.caseId) {
        // HIGH certainty - single case match
        return {
          state: EmailClassificationState.Classified,
          caseId: contactMatch.caseId,
          clientId: contactMatch.clientId,
          confidence: CONFIDENCE.HIGH,
          reason: `Contact ${address} matched to single active case ${contactMatch.caseNumber}`,
          matchType: this.mapContactMatchType(contactMatch.matchType),
        };
      }

      if (contactMatch.certainty === 'LOW' && contactMatch.clientId) {
        // LOW certainty - known client, multiple cases
        return {
          state: EmailClassificationState.ClientInbox,
          caseId: null,
          clientId: contactMatch.clientId,
          confidence: CONFIDENCE.LOW,
          reason: `Contact ${address} matched to client ${contactMatch.clientName} with multiple active cases`,
          matchType: this.mapContactMatchType(contactMatch.matchType),
        };
      }
    }

    // No match found - unknown sender
    return {
      state: EmailClassificationState.Uncertain,
      caseId: null,
      clientId: null,
      confidence: CONFIDENCE.NONE,
      reason: 'Unknown sender - no matching contacts found',
      matchType: 'UNKNOWN',
    };
  }

  // ============================================================================
  // Private Methods - Helpers
  // ============================================================================

  /**
   * Check if the email is from a sent folder
   */
  private isSentEmail(parentFolderName?: string): boolean {
    if (!parentFolderName) return false;
    return SENT_FOLDER_NAMES.some((name) => name.toLowerCase() === parentFolderName.toLowerCase());
  }

  /**
   * Get all recipient addresses from an email (TO + CC)
   */
  private getRecipientAddresses(email: EmailForClassification): string[] {
    const addresses: string[] = [];

    for (const recipient of email.toRecipients) {
      if (recipient.address) {
        addresses.push(recipient.address);
      }
    }

    if (email.ccRecipients) {
      for (const recipient of email.ccRecipients) {
        if (recipient.address) {
          addresses.push(recipient.address);
        }
      }
    }

    return addresses;
  }

  /**
   * Extract domain from email address
   */
  private extractDomain(email: string): string | null {
    const atIndex = email.indexOf('@');
    if (atIndex === -1) return null;
    return email.substring(atIndex + 1).toLowerCase();
  }

  /**
   * Find a case that matches any of the given reference numbers
   */
  private async findCaseByReferences(
    references: string[],
    firmId: string
  ): Promise<{ id: string; caseNumber: string; clientId: string } | null> {
    // Get all active cases with reference numbers
    const cases = await prisma.case.findMany({
      where: {
        firmId,
        status: CaseStatus.Active,
        referenceNumbers: { isEmpty: false },
      },
      select: {
        id: true,
        caseNumber: true,
        clientId: true,
        referenceNumbers: true,
      },
    });

    // Check each case for a reference match
    for (const caseRecord of cases) {
      if (matchesCase(references, caseRecord.referenceNumbers)) {
        return {
          id: caseRecord.id,
          caseNumber: caseRecord.caseNumber,
          clientId: caseRecord.clientId,
        };
      }
    }

    return null;
  }

  /**
   * Map contact matcher's match type to our classification match type
   */
  private mapContactMatchType(
    matchType: 'EXACT_EMAIL' | 'DOMAIN' | 'ACTOR' | 'CLIENT_CONTACT'
  ): ClassificationMatchType {
    switch (matchType) {
      case 'DOMAIN':
        return 'DOMAIN';
      case 'EXACT_EMAIL':
      case 'ACTOR':
      case 'CLIENT_CONTACT':
        return 'CONTACT';
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let emailClassifierServiceInstance: EmailClassifierService | null = null;

/**
 * Get the singleton EmailClassifierService instance
 */
export function getEmailClassifierService(): EmailClassifierService {
  if (!emailClassifierServiceInstance) {
    emailClassifierServiceInstance = new EmailClassifierService();
  }
  return emailClassifierServiceInstance;
}

/**
 * Main classification function - convenience export
 *
 * @param email - The email to classify
 * @param firmId - The firm ID context
 * @param userId - The user ID who owns the mailbox
 * @returns Classification result
 */
export async function classifyEmail(
  email: EmailForClassification,
  firmId: string,
  userId: string
): Promise<ClassificationResult> {
  return getEmailClassifierService().classifyEmail(email, firmId, userId);
}

/** Export singleton instance */
export const emailClassifierService = getEmailClassifierService();
